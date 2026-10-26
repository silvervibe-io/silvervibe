import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AddonConnectionStatus,
  AddonProvider,
  WorkspaceRole,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { AddonStatusDto } from '../addon-status.dto';
import {
  ConnectTeamsDto,
  SelectTeamsChannelDto,
  TeamsConnectionDto,
  TeamsGraphChannelDto,
  TeamsGraphTeamDto,
  TeamsOAuthStartDto,
} from './teams.dto';

type TeamsAuthMode = 'oauth' | 'webhook';

type TeamsMetadata = {
  channelLabel?: string;
  teamId?: string;
  channelId?: string;
  teamName?: string;
  authMode?: TeamsAuthMode;
  oauthNonce?: string;
  oauthExp?: number;
  oauthUserId?: string;
};

type OAuthStatePayload = {
  workspaceId: string;
  userId: string;
  exp: number;
  nonce: string;
};

type StoredOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const STATE_TTL_MS = 15 * 60 * 1000;
const GRAPH_SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'ChannelMessage.Send',
  'Team.ReadBasic.All',
  'Channel.ReadBasic.All',
].join(' ');

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  status(): AddonStatusDto {
    return { name: 'teams', status: 'ready' };
  }

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for Teams connections',
      );
    }
  }

  private teamsClientId(): string | undefined {
    return process.env['TEAMS_CLIENT_ID']?.trim() || undefined;
  }

  private teamsClientSecret(): string | undefined {
    return process.env['TEAMS_CLIENT_SECRET']?.trim() || undefined;
  }

  private teamsTenant(): string {
    return process.env['TEAMS_TENANT_ID']?.trim() || 'organizations';
  }

  oauthConfigured(): boolean {
    return Boolean(this.teamsClientId() && this.teamsClientSecret());
  }

  private requireOAuthConfigured(): { clientId: string; clientSecret: string } {
    const clientId = this.teamsClientId();
    const clientSecret = this.teamsClientSecret();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Teams OAuth is not configured (TEAMS_CLIENT_ID / TEAMS_CLIENT_SECRET)',
      );
    }
    return { clientId, clientSecret };
  }

  private publicApiBase(): string {
    const fromEnv = process.env['PUBLIC_API_URL']?.trim();
    if (fromEnv) {
      return fromEnv.replace(/\/$/, '');
    }
    const port = process.env['PORT'] || process.env['API_PORT'] || '3000';
    return `http://localhost:${port}/api`;
  }

  redirectUri(): string {
    const override = process.env['TEAMS_REDIRECT_URI']?.trim();
    if (override) {
      return override;
    }
    return `${this.publicApiBase()}/addons/teams/oauth/callback`;
  }

  private standupAppOrigin(): string {
    return (
      process.env['PUBLIC_STANDUP_URL']?.trim().replace(/\/$/, '') ||
      'http://localhost:4201'
    );
  }

  workspaceRedirect(
    result: 'connected' | 'pick' | 'error',
    detail?: unknown,
  ): string {
    const url = new URL('/app/workspace', `${this.standupAppOrigin()}/`);
    url.searchParams.set('teams', result);
    const detailText = this.asSingleString(detail);
    if (detailText) {
      url.searchParams.set('teamsDetail', detailText.slice(0, 120));
    }
    return url.toString();
  }

  private asSingleString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      const trimmed = value[0].trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  }

  private async requireWorkspaceAdmin(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    if (
      membership.role !== WorkspaceRole.OWNER &&
      membership.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException('Workspace admin required');
    }
  }

  private assertWebhookUrl(url: string): string {
    const trimmed = url.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException(
        'incomingWebhookUrl must be a valid Microsoft Teams Incoming Webhook URL',
      );
    }
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('incomingWebhookUrl must use https');
    }
    const host = parsed.hostname.toLowerCase();
    const isOfficeWebhookHost =
      host === 'webhook.office.com' || host.endsWith('.webhook.office.com');
    const isOutlookWebhook =
      host === 'outlook.office.com' &&
      parsed.pathname.toLowerCase().startsWith('/webhook');
    if (!isOfficeWebhookHost && !isOutlookWebhook) {
      throw new BadRequestException(
        'incomingWebhookUrl must be a Microsoft Teams Incoming Webhook (*.webhook.office.com or outlook.office.com/webhook)',
      );
    }
    return trimmed;
  }

  private asMetadata(raw: unknown): TeamsMetadata {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    const obj = raw as Record<string, unknown>;
    const str = (key: string): string | undefined => {
      const v = obj[key];
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const authMode = str('authMode');
    const oauthExpRaw = obj['oauthExp'];
    return {
      channelLabel: str('channelLabel'),
      teamId: str('teamId'),
      channelId: str('channelId'),
      teamName: str('teamName'),
      authMode:
        authMode === 'oauth' || authMode === 'webhook' ? authMode : undefined,
      oauthNonce: str('oauthNonce'),
      oauthExp: typeof oauthExpRaw === 'number' ? oauthExpRaw : undefined,
      oauthUserId: str('oauthUserId'),
    };
  }

  private detectAuthMode(
    secretsRef: string | null | undefined,
    meta: TeamsMetadata,
  ): TeamsAuthMode | null {
    if (!secretsRef?.trim()) {
      return null;
    }
    if (meta.authMode) {
      return meta.authMode;
    }
    if (secretsRef.trim().startsWith('{')) {
      return 'oauth';
    }
    if (secretsRef.startsWith('https://')) {
      return 'webhook';
    }
    return 'webhook';
  }

  private parseOAuthTokens(secretsRef: string): StoredOAuthTokens | null {
    try {
      const parsed = JSON.parse(secretsRef) as Partial<StoredOAuthTokens>;
      if (
        typeof parsed.accessToken !== 'string' ||
        !parsed.accessToken ||
        typeof parsed.refreshToken !== 'string' ||
        !parsed.refreshToken ||
        typeof parsed.expiresAt !== 'number'
      ) {
        return null;
      }
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expiresAt: parsed.expiresAt,
      };
    } catch {
      return null;
    }
  }

  private encodeOAuthState(payload: OAuthStatePayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private async consumeOAuthState(state: string): Promise<OAuthStatePayload> {
    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      ) as OAuthStatePayload;
    } catch {
      throw new BadRequestException('Invalid OAuth state payload');
    }
    if (
      typeof payload.workspaceId !== 'string' ||
      !payload.workspaceId.trim() ||
      typeof payload.userId !== 'string' ||
      !payload.userId.trim() ||
      typeof payload.nonce !== 'string' ||
      !payload.nonce.trim() ||
      typeof payload.exp !== 'number'
    ) {
      throw new BadRequestException('Invalid OAuth state fields');
    }
    if (Date.now() > payload.exp) {
      throw new BadRequestException('OAuth state expired');
    }

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId: payload.workspaceId,
          provider: AddonProvider.TEAMS,
        },
      },
    });
    if (!connection || connection.status !== AddonConnectionStatus.PENDING) {
      throw new BadRequestException('OAuth install is not pending');
    }
    const meta = this.asMetadata(connection.metadataJson);
    if (
      !meta.oauthNonce ||
      meta.oauthNonce !== payload.nonce ||
      meta.oauthUserId !== payload.userId
    ) {
      throw new BadRequestException('OAuth state nonce mismatch');
    }
    if (typeof meta.oauthExp === 'number' && Date.now() > meta.oauthExp) {
      throw new BadRequestException('OAuth state expired');
    }
    return {
      workspaceId: payload.workspaceId.trim(),
      userId: payload.userId.trim(),
      exp: payload.exp,
      nonce: payload.nonce.trim(),
    };
  }

  async getConnection(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<TeamsConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const [connection, tool] = await Promise.all([
      this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.TEAMS,
          },
        },
      }),
      this.prisma.workspaceTool.findUnique({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsTeams,
          },
        },
      }),
    ]);

    const meta = this.asMetadata(connection?.metadataJson);
    const secretsRef = connection?.secretsRef?.trim() ?? '';
    const authMode = this.detectAuthMode(connection?.secretsRef, meta);
    const configured = Boolean(secretsRef);
    const needsChannel =
      authMode === 'oauth' && configured && (!meta.teamId || !meta.channelId);

    return {
      status: (connection?.status ??
        AddonConnectionStatus.DISCONNECTED) as TeamsConnectionDto['status'],
      configured,
      authMode,
      channelLabel: meta.channelLabel ?? null,
      needsChannel,
      toolEnabled: tool?.enabled ?? false,
      oauthAvailable: this.oauthConfigured(),
    };
  }

  async startOAuth(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<TeamsOAuthStartDto> {
    this.ensureDb();
    const { clientId } = this.requireOAuthConfigured();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const nonce = randomBytes(16).toString('hex');
    const exp = Date.now() + STATE_TTL_MS;
    const state = this.encodeOAuthState({
      workspaceId,
      userId,
      exp,
      nonce,
    });
    const pendingMeta: TeamsMetadata = {
      authMode: 'oauth',
      oauthNonce: nonce,
      oauthExp: exp,
      oauthUserId: userId,
    };

    await this.prisma.addonConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.TEAMS,
        },
      },
      create: {
        workspaceId,
        provider: AddonProvider.TEAMS,
        status: AddonConnectionStatus.PENDING,
        metadataJson: pendingMeta,
      },
      update: {
        status: AddonConnectionStatus.PENDING,
        secretsRef: null,
        metadataJson: pendingMeta,
      },
    });

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri(),
      response_mode: 'query',
      scope: GRAPH_SCOPES,
      state,
    });

    return {
      authorizeUrl: `https://login.microsoftonline.com/${this.teamsTenant()}/oauth2/v2.0/authorize?${params.toString()}`,
    };
  }

  async completeOAuthCallback(
    code: unknown,
    state: unknown,
    errorFromMs: unknown,
  ): Promise<string> {
    const errorText = this.asSingleString(errorFromMs);
    if (errorText) {
      this.logger.warn(`Teams OAuth denied: ${errorText}`);
      return this.workspaceRedirect('error', errorText);
    }
    const codeText = this.asSingleString(code);
    const stateText = this.asSingleString(state);
    if (!codeText || !stateText) {
      return this.workspaceRedirect('error', 'missing_code_or_state');
    }

    try {
      this.ensureDb();
      const { clientId, clientSecret } = this.requireOAuthConfigured();
      const payload = await this.consumeOAuthState(stateText);
      await this.requireWorkspaceAdmin(payload.workspaceId, payload.userId);

      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: codeText,
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
        scope: GRAPH_SCOPES,
      });

      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${this.teamsTenant()}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        },
      );
      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      };

      if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.refresh_token) {
        this.logger.warn(
          `Teams token exchange failed: ${tokenJson.error ?? tokenRes.status} ${tokenJson.error_description ?? ''}`,
        );
        return this.workspaceRedirect(
          'error',
          tokenJson.error ?? 'token_exchange_failed',
        );
      }

      const tokens: StoredOAuthTokens = {
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        expiresAt: Date.now() + (tokenJson.expires_in ?? 3600) * 1000,
      };

      await this.prisma.addonConnection.upsert({
        where: {
          workspaceId_provider: {
            workspaceId: payload.workspaceId,
            provider: AddonProvider.TEAMS,
          },
        },
        create: {
          workspaceId: payload.workspaceId,
          provider: AddonProvider.TEAMS,
          status: AddonConnectionStatus.PENDING,
          secretsRef: JSON.stringify(tokens),
          metadataJson: { authMode: 'oauth' },
        },
        update: {
          status: AddonConnectionStatus.PENDING,
          secretsRef: JSON.stringify(tokens),
          metadataJson: { authMode: 'oauth' },
        },
      });

      return this.workspaceRedirect('pick');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Teams OAuth callback error: ${message}`);
      return this.workspaceRedirect('error', 'callback_failed');
    }
  }

  async listJoinedTeams(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<TeamsGraphTeamDto[]> {
    const accessToken = await this.requireOAuthAccessToken(workspaceId, user);
    const res = await fetch('https://graph.microsoft.com/v1.0/me/joinedTeams', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json().catch(() => ({}))) as {
      value?: Array<{ id?: string; displayName?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new BadRequestException(
        json.error?.message ?? `Failed to list Teams (${res.status})`,
      );
    }
    return (json.value ?? [])
      .filter((t) => typeof t.id === 'string' && t.id)
      .map((t) => ({
        id: t.id as string,
        displayName: t.displayName?.trim() || (t.id as string),
      }));
  }

  async listChannels(
    workspaceId: string,
    user: VerifiedUser,
    teamId: string,
  ): Promise<TeamsGraphChannelDto[]> {
    const accessToken = await this.requireOAuthAccessToken(workspaceId, user);
    const id = teamId.trim();
    if (!id) {
      throw new BadRequestException('teamId is required');
    }
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(id)}/channels`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const json = (await res.json().catch(() => ({}))) as {
      value?: Array<{ id?: string; displayName?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new BadRequestException(
        json.error?.message ?? `Failed to list channels (${res.status})`,
      );
    }
    return (json.value ?? [])
      .filter((c) => typeof c.id === 'string' && c.id)
      .map((c) => ({
        id: c.id as string,
        displayName: c.displayName?.trim() || (c.id as string),
      }));
  }

  async selectChannel(
    workspaceId: string,
    user: VerifiedUser,
    body: SelectTeamsChannelDto,
  ): Promise<TeamsConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.TEAMS,
        },
      },
    });
    if (!connection?.secretsRef?.trim()) {
      throw new BadRequestException('Connect Teams with OAuth first');
    }
    const meta = this.asMetadata(connection.metadataJson);
    if (this.detectAuthMode(connection.secretsRef, meta) !== 'oauth') {
      throw new BadRequestException(
        'Channel picker is only for OAuth installs',
      );
    }
    if (!this.parseOAuthTokens(connection.secretsRef.trim())) {
      throw new BadRequestException('Invalid Teams OAuth token storage');
    }

    const teamId = body.teamId.trim();
    const channelId = body.channelId.trim();
    const channelLabel = body.channelLabel?.trim() || undefined;
    const metadataJson: TeamsMetadata = {
      authMode: 'oauth',
      teamId,
      channelId,
      channelLabel,
    };

    await this.prisma.$transaction([
      this.prisma.addonConnection.update({
        where: { id: connection.id },
        data: {
          status: AddonConnectionStatus.CONNECTED,
          externalId: teamId,
          metadataJson,
        },
      }),
      this.prisma.workspaceTool.upsert({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsTeams,
          },
        },
        create: {
          workspaceId,
          toolKey: TOOL_KEYS.addonsTeams,
          enabled: true,
        },
        update: { enabled: true },
      }),
    ]);

    return this.getConnection(workspaceId, user);
  }

  private async requireOAuthAccessToken(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<string> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.TEAMS,
        },
      },
    });
    if (!connection?.secretsRef?.trim()) {
      throw new BadRequestException('Teams is not connected');
    }
    const meta = this.asMetadata(connection.metadataJson);
    if (this.detectAuthMode(connection.secretsRef, meta) !== 'oauth') {
      throw new BadRequestException('Teams OAuth tokens required');
    }
    const tokens = this.parseOAuthTokens(connection.secretsRef.trim());
    if (!tokens) {
      throw new BadRequestException('Invalid Teams OAuth token storage');
    }
    return this.ensureFreshAccessToken(connection.id, tokens);
  }

  private async ensureFreshAccessToken(
    connectionId: string,
    tokens: StoredOAuthTokens,
  ): Promise<string> {
    if (Date.now() < tokens.expiresAt - 60_000) {
      return tokens.accessToken;
    }

    const { clientId, clientSecret } = this.requireOAuthConfigured();
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
      scope: GRAPH_SCOPES,
    });
    const res = await fetch(
      `https://login.microsoftonline.com/${this.teamsTenant()}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !json.access_token) {
      throw new BadRequestException(
        json.error ?? 'Failed to refresh Teams access token',
      );
    }
    const next: StoredOAuthTokens = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? tokens.refreshToken,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
    await this.prisma.addonConnection.update({
      where: { id: connectionId },
      data: { secretsRef: JSON.stringify(next) },
    });
    return next.accessToken;
  }

  /** @deprecated Prefer startOAuth; kept for existing webhook installs. */
  async connect(
    workspaceId: string,
    user: VerifiedUser,
    body: ConnectTeamsDto,
  ): Promise<TeamsConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const webhookUrl = this.assertWebhookUrl(body.incomingWebhookUrl);
    const channelLabel = body.channelLabel?.trim() || undefined;
    const metadataJson: TeamsMetadata = {
      authMode: 'webhook',
      ...(channelLabel ? { channelLabel } : {}),
    };

    await this.prisma.$transaction([
      this.prisma.addonConnection.upsert({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.TEAMS,
          },
        },
        create: {
          workspaceId,
          provider: AddonProvider.TEAMS,
          status: AddonConnectionStatus.CONNECTED,
          secretsRef: webhookUrl,
          metadataJson,
        },
        update: {
          status: AddonConnectionStatus.CONNECTED,
          secretsRef: webhookUrl,
          metadataJson,
        },
      }),
      this.prisma.workspaceTool.upsert({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsTeams,
          },
        },
        create: {
          workspaceId,
          toolKey: TOOL_KEYS.addonsTeams,
          enabled: true,
        },
        update: { enabled: true },
      }),
    ]);

    return this.getConnection(workspaceId, user);
  }

  async disconnect(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<TeamsConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const existing = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.TEAMS,
        },
      },
    });
    if (existing) {
      await this.prisma.addonConnection.update({
        where: { id: existing.id },
        data: {
          status: AddonConnectionStatus.DISCONNECTED,
          secretsRef: null,
          externalId: null,
          metadataJson: {},
        },
      });
    }

    return this.getConnection(workspaceId, user);
  }

  /**
   * Posts standup summary via Graph (OAuth) or Incoming Webhook (legacy).
   * Soft-fail: logs and returns false on any error (never throws to callers).
   */
  async postStandupDigest(params: {
    workspaceId: string;
    teamName: string;
    entryDate: string;
    content: string;
  }): Promise<boolean> {
    if (!this.prisma.isEnabled()) {
      return false;
    }

    try {
      const [tool, connection] = await Promise.all([
        this.prisma.workspaceTool.findUnique({
          where: {
            workspaceId_toolKey: {
              workspaceId: params.workspaceId,
              toolKey: TOOL_KEYS.addonsTeams,
            },
          },
        }),
        this.prisma.addonConnection.findUnique({
          where: {
            workspaceId_provider: {
              workspaceId: params.workspaceId,
              provider: AddonProvider.TEAMS,
            },
          },
        }),
      ]);

      if (!tool?.enabled) {
        return false;
      }
      if (
        connection?.status !== AddonConnectionStatus.CONNECTED ||
        !connection.secretsRef?.trim()
      ) {
        return false;
      }

      const secretsRef = connection.secretsRef.trim();
      const meta = this.asMetadata(connection.metadataJson);
      const channel = meta.channelLabel ? ` (${meta.channelLabel})` : '';
      const text = [
        `**VibeStandup — ${params.teamName}${channel}**`,
        `_${params.entryDate}_`,
        '',
        params.content,
      ].join('\n');

      const mode = this.detectAuthMode(secretsRef, meta);
      if (mode === 'oauth') {
        return this.postViaGraph(
          connection.id,
          secretsRef,
          meta,
          text,
          params.workspaceId,
        );
      }
      return this.postViaWebhook(secretsRef, text, params.workspaceId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Teams digest post error for workspace ${params.workspaceId}: ${message}`,
      );
      return false;
    }
  }

  private async postViaGraph(
    connectionId: string,
    secretsRef: string,
    meta: TeamsMetadata,
    text: string,
    workspaceId: string,
  ): Promise<boolean> {
    if (!meta.teamId || !meta.channelId) {
      this.logger.warn(
        `Teams OAuth digest skipped for workspace ${workspaceId}: missing team/channel`,
      );
      return false;
    }
    const tokens = this.parseOAuthTokens(secretsRef);
    if (!tokens) {
      this.logger.warn(
        `Teams OAuth digest skipped for workspace ${workspaceId}: invalid tokens`,
      );
      return false;
    }

    let accessToken: string;
    try {
      accessToken = await this.ensureFreshAccessToken(connectionId, tokens);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Teams token refresh failed for workspace ${workspaceId}: ${message}`,
      );
      return false;
    }

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(meta.teamId)}/channels/${encodeURIComponent(meta.channelId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: { contentType: 'text', content: text },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(
        `Teams Graph post failed (${res.status}) for workspace ${workspaceId}: ${body.slice(0, 200)}`,
      );
      return false;
    }
    return true;
  }

  private async postViaWebhook(
    webhookUrl: string,
    text: string,
    workspaceId: string,
  ): Promise<boolean> {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(
        `Teams digest post failed (${res.status}) for workspace ${workspaceId}: ${body.slice(0, 200)}`,
      );
      return false;
    }
    return true;
  }
}
