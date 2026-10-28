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
  TeamRole,
  WorkspaceRole,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { AddonStatusDto } from '../addon-status.dto';
import {
  ConnectSlackDto,
  SetTeamSlackChannelDto,
  SlackChannelOptionDto,
  SlackChannelsDto,
  SlackConnectionDto,
  SlackOAuthStartDto,
  TeamSlackChannelDto,
} from './slack.dto';

type SlackAuthMode = 'oauth' | 'webhook';

type TeamSlackChannelMeta = {
  channelId: string;
  channelLabel?: string;
};

type SlackMetadata = {
  channelLabel?: string;
  channelId?: string;
  /** Incoming webhook URL from OAuth install; used if chat.postMessage hits not_in_channel. */
  incomingWebhookUrl?: string;
  teamId?: string;
  teamName?: string;
  authMode?: SlackAuthMode;
  /** Per VibeStandup team overrides; workspace channelId remains the default. */
  teamChannels?: Record<string, TeamSlackChannelMeta>;
  /** One-time OAuth CSRF nonce stored server-side (not an HMAC of the client secret). */
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

const OAUTH_SCOPES = [
  'chat:write',
  'channels:join',
  'channels:read',
  'groups:read',
  'incoming-webhook',
].join(',');

const STATE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  status(): AddonStatusDto {
    return { name: 'slack', status: 'ready' };
  }

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for Slack connections',
      );
    }
  }

  private slackClientId(): string | undefined {
    return process.env['SLACK_CLIENT_ID']?.trim() || undefined;
  }

  private slackClientSecret(): string | undefined {
    return process.env['SLACK_CLIENT_SECRET']?.trim() || undefined;
  }

  oauthConfigured(): boolean {
    return Boolean(this.slackClientId() && this.slackClientSecret());
  }

  private requireOAuthConfigured(): { clientId: string; clientSecret: string } {
    const clientId = this.slackClientId();
    const clientSecret = this.slackClientSecret();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Slack OAuth is not configured (SLACK_CLIENT_ID / SLACK_CLIENT_SECRET)',
      );
    }
    return { clientId, clientSecret };
  }

  /** Public API base including `/api`, e.g. https://api.silvervibe.io/api */
  private publicApiBase(): string {
    const fromEnv = process.env['PUBLIC_API_URL']?.trim();
    if (fromEnv) {
      return fromEnv.replace(/\/$/, '');
    }
    const port = process.env['PORT'] || process.env['API_PORT'] || '3000';
    return `http://localhost:${port}/api`;
  }

  redirectUri(): string {
    const override = process.env['SLACK_REDIRECT_URI']?.trim();
    if (override) {
      return override;
    }
    return `${this.publicApiBase()}/addons/slack/oauth/callback`;
  }

  private standupAppOrigin(): string {
    return (
      process.env['PUBLIC_STANDUP_URL']?.trim().replace(/\/$/, '') ||
      'http://localhost:4201'
    );
  }

  workspaceRedirect(result: 'connected' | 'error', detail?: unknown): string {
    const url = new URL('/app/workspace', `${this.standupAppOrigin()}/`);
    url.searchParams.set('slack', result);
    const detailText = this.asSingleString(detail);
    if (detailText) {
      url.searchParams.set('slackDetail', detailText.slice(0, 120));
    }
    return url.toString();
  }

  /** Query/body values may arrive as string | string[]; always take a single string. */
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
    if (!trimmed.startsWith('https://hooks.slack.com/')) {
      throw new BadRequestException(
        'incomingWebhookUrl must be a Slack Incoming Webhook (https://hooks.slack.com/...)',
      );
    }
    return trimmed;
  }

  private asMetadata(raw: unknown): SlackMetadata {
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
    const teamChannelsRaw = obj['teamChannels'];
    const teamChannels: Record<string, TeamSlackChannelMeta> = {};
    if (
      teamChannelsRaw &&
      typeof teamChannelsRaw === 'object' &&
      !Array.isArray(teamChannelsRaw)
    ) {
      for (const [teamId, value] of Object.entries(
        teamChannelsRaw as Record<string, unknown>,
      )) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          continue;
        }
        const entry = value as Record<string, unknown>;
        const channelId =
          typeof entry['channelId'] === 'string'
            ? entry['channelId'].trim()
            : '';
        if (!channelId) {
          continue;
        }
        const channelLabel =
          typeof entry['channelLabel'] === 'string' &&
          entry['channelLabel'].trim()
            ? entry['channelLabel'].trim()
            : undefined;
        teamChannels[teamId] = { channelId, channelLabel };
      }
    }
    return {
      channelLabel: str('channelLabel'),
      channelId: str('channelId'),
      incomingWebhookUrl: str('incomingWebhookUrl'),
      teamId: str('teamId'),
      teamName: str('teamName'),
      teamChannels:
        Object.keys(teamChannels).length > 0 ? teamChannels : undefined,
      authMode:
        authMode === 'oauth' || authMode === 'webhook' ? authMode : undefined,
      oauthNonce: str('oauthNonce'),
      oauthExp: typeof oauthExpRaw === 'number' ? oauthExpRaw : undefined,
      oauthUserId: str('oauthUserId'),
    };
  }

  /** Team override if set; otherwise workspace default from OAuth. */
  resolveChannelForTeam(
    meta: SlackMetadata,
    teamId?: string,
  ): { channelId?: string; channelLabel?: string; isOverride: boolean } {
    if (teamId) {
      const override = meta.teamChannels?.[teamId];
      if (override?.channelId) {
        return {
          channelId: override.channelId,
          channelLabel: override.channelLabel,
          isOverride: true,
        };
      }
    }
    return {
      channelId: meta.channelId,
      channelLabel: meta.channelLabel,
      isOverride: false,
    };
  }

  private async requireTeamAdmin(
    teamId: string,
    userId: string,
  ): Promise<{ workspaceId: string }> {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: { team: { select: { workspaceId: true } } },
    });
    if (membership) {
      if (membership.role !== TeamRole.ADMIN) {
        throw new ForbiddenException('Team admin required');
      }
      return { workspaceId: membership.team.workspaceId };
    }

    // Match TeamsService: workspace OWNER/ADMIN can admin any team in the org.
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { workspaceId: true },
    });
    if (!team) {
      throw new ForbiddenException('Not a member of this team');
    }
    const ws = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: team.workspaceId, userId },
      },
    });
    if (
      ws &&
      (ws.role === WorkspaceRole.OWNER || ws.role === WorkspaceRole.ADMIN)
    ) {
      return { workspaceId: team.workspaceId };
    }
    throw new ForbiddenException('Team admin required');
  }

  private detectAuthMode(
    secretsRef: string | null | undefined,
    meta: SlackMetadata,
  ): SlackAuthMode | null {
    if (!secretsRef?.trim()) {
      return null;
    }
    if (meta.authMode) {
      return meta.authMode;
    }
    if (secretsRef.startsWith('https://hooks.slack.com/')) {
      return 'webhook';
    }
    if (secretsRef.startsWith('xoxb-')) {
      return 'oauth';
    }
    return 'webhook';
  }

  private encodeOAuthState(payload: OAuthStatePayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  /**
   * Validates OAuth `state` against the PENDING AddonConnection nonce in Neon
   * (CSRF protection without hashing SLACK_CLIENT_SECRET).
   */
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
          provider: AddonProvider.SLACK,
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
  ): Promise<SlackConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const [connection, tool] = await Promise.all([
      this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.SLACK,
          },
        },
      }),
      this.prisma.workspaceTool.findUnique({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsSlack,
          },
        },
      }),
    ]);

    const meta = this.asMetadata(connection?.metadataJson);
    const configured = Boolean(connection?.secretsRef?.trim());
    return {
      status: (connection?.status ??
        AddonConnectionStatus.DISCONNECTED) as SlackConnectionDto['status'],
      configured,
      authMode: this.detectAuthMode(connection?.secretsRef, meta),
      channelLabel: meta.channelLabel ?? null,
      toolEnabled: tool?.enabled ?? false,
      oauthAvailable: this.oauthConfigured(),
    };
  }

  async startOAuth(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<SlackOAuthStartDto> {
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
    const pendingMeta: SlackMetadata = {
      authMode: 'oauth',
      oauthNonce: nonce,
      oauthExp: exp,
      oauthUserId: userId,
    };

    await this.prisma.addonConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.SLACK,
        },
      },
      create: {
        workspaceId,
        provider: AddonProvider.SLACK,
        status: AddonConnectionStatus.PENDING,
        metadataJson: pendingMeta,
      },
      update: {
        status: AddonConnectionStatus.PENDING,
        metadataJson: pendingMeta,
      },
    });

    const params = new URLSearchParams({
      client_id: clientId,
      scope: OAUTH_SCOPES,
      redirect_uri: this.redirectUri(),
      state,
    });

    return {
      authorizeUrl: `https://slack.com/oauth/v2/authorize?${params.toString()}`,
    };
  }

  /**
   * Completes Slack OAuth and returns the standup workspace redirect URL.
   * Never throws to the browser — errors become ?slack=error redirects.
   */
  async completeOAuthCallback(
    code: unknown,
    state: unknown,
    errorFromSlack: unknown,
  ): Promise<string> {
    const errorText = this.asSingleString(errorFromSlack);
    if (errorText) {
      this.logger.warn(`Slack OAuth denied: ${errorText}`);
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
      });

      const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const tokenJson = (await tokenRes.json()) as {
        ok?: boolean;
        error?: string;
        access_token?: string;
        team?: { id?: string; name?: string };
        incoming_webhook?: {
          channel?: string;
          channel_id?: string;
          url?: string;
        };
      };

      if (!tokenJson.ok || !tokenJson.access_token) {
        this.logger.warn(
          `Slack oauth.v2.access failed: ${tokenJson.error ?? tokenRes.status}`,
        );
        return this.workspaceRedirect(
          'error',
          tokenJson.error ?? 'token_exchange_failed',
        );
      }

      const channelId = tokenJson.incoming_webhook?.channel_id?.trim();
      const channelLabel =
        tokenJson.incoming_webhook?.channel?.trim() || undefined;
      const incomingWebhookUrl =
        tokenJson.incoming_webhook?.url?.trim() || undefined;
      if (!channelId) {
        this.logger.warn(
          'Slack OAuth succeeded but no incoming_webhook.channel_id — ask admin to reinstall and pick a channel',
        );
        return this.workspaceRedirect('error', 'missing_channel');
      }

      const metadataJson: SlackMetadata = {
        authMode: 'oauth',
        channelId,
        channelLabel,
        incomingWebhookUrl,
        teamId: tokenJson.team?.id,
        teamName: tokenJson.team?.name,
      };

      await this.prisma.$transaction([
        this.prisma.addonConnection.upsert({
          where: {
            workspaceId_provider: {
              workspaceId: payload.workspaceId,
              provider: AddonProvider.SLACK,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            provider: AddonProvider.SLACK,
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: tokenJson.access_token,
            externalId: tokenJson.team?.id ?? null,
            metadataJson,
          },
          update: {
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: tokenJson.access_token,
            externalId: tokenJson.team?.id ?? null,
            metadataJson,
          },
        }),
        this.prisma.workspaceTool.upsert({
          where: {
            workspaceId_toolKey: {
              workspaceId: payload.workspaceId,
              toolKey: TOOL_KEYS.addonsSlack,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            toolKey: TOOL_KEYS.addonsSlack,
            enabled: true,
          },
          update: { enabled: true },
        }),
      ]);

      return this.workspaceRedirect('connected');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Slack OAuth callback error: ${message}`);
      return this.workspaceRedirect('error', 'callback_failed');
    }
  }

  /** @deprecated Prefer startOAuth; kept for existing webhook installs. */
  async connect(
    workspaceId: string,
    user: VerifiedUser,
    body: ConnectSlackDto,
  ): Promise<SlackConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const webhookUrl = this.assertWebhookUrl(body.incomingWebhookUrl);
    const channelLabel = body.channelLabel?.trim() || undefined;
    const metadataJson: SlackMetadata = {
      authMode: 'webhook',
      ...(channelLabel ? { channelLabel } : {}),
    };

    await this.prisma.$transaction([
      this.prisma.addonConnection.upsert({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.SLACK,
          },
        },
        create: {
          workspaceId,
          provider: AddonProvider.SLACK,
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
            toolKey: TOOL_KEYS.addonsSlack,
          },
        },
        create: {
          workspaceId,
          toolKey: TOOL_KEYS.addonsSlack,
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
  ): Promise<SlackConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const existing = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.SLACK,
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
   * Posts standup summary markdown to Slack (OAuth chat.postMessage or legacy webhook).
   * Soft-fail: logs and returns false on any error (never throws to callers).
   */
  async listChannelsForTeam(
    teamId: string,
    user: VerifiedUser,
  ): Promise<SlackChannelsDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);
    return this.listChannelsForWorkspace(workspaceId);
  }

  private async listChannelsForWorkspace(
    workspaceId: string,
  ): Promise<SlackChannelsDto> {
    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.SLACK,
        },
      },
    });
    if (
      connection?.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.startsWith('xoxb-')
    ) {
      throw new BadRequestException(
        'Slack OAuth must be connected to list channels',
      );
    }

    const channels: SlackChannelOptionDto[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const url = new URL('https://slack.com/api/conversations.list');
      url.searchParams.set('types', 'public_channel,private_channel');
      url.searchParams.set('exclude_archived', 'true');
      url.searchParams.set('limit', '200');
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${connection.secretsRef.trim()}` },
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        channels?: Array<{ id?: string; name?: string; is_channel?: boolean }>;
        response_metadata?: { next_cursor?: string };
      };
      if (!res.ok || !json.ok) {
        throw new BadRequestException(
          `Slack conversations.list failed: ${json.error ?? res.status}`,
        );
      }
      for (const ch of json.channels ?? []) {
        if (!ch.id || !ch.name) {
          continue;
        }
        channels.push({ id: ch.id, label: `#${ch.name}` });
      }
      cursor = json.response_metadata?.next_cursor?.trim() || undefined;
      if (!cursor) {
        break;
      }
    }

    channels.sort((a, b) => a.label.localeCompare(b.label));
    return { channels };
  }

  async getTeamChannel(
    teamId: string,
    user: VerifiedUser,
  ): Promise<TeamSlackChannelDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.SLACK,
        },
      },
    });
    const meta = this.asMetadata(connection?.metadataJson);
    const connected =
      connection?.status === AddonConnectionStatus.CONNECTED &&
      Boolean(connection.secretsRef?.trim());
    const resolved = this.resolveChannelForTeam(meta, teamId);
    return {
      channelId: resolved.channelId ?? null,
      channelLabel: resolved.channelLabel ?? null,
      isOverride: resolved.isOverride,
      workspaceChannelId: meta.channelId ?? null,
      workspaceChannelLabel: meta.channelLabel ?? null,
      slackConnected: connected,
    };
  }

  async setTeamChannel(
    teamId: string,
    user: VerifiedUser,
    body: SetTeamSlackChannelDto,
  ): Promise<TeamSlackChannelDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const channelId = body.channelId.trim();
    if (!/^C[A-Z0-9]+$/i.test(channelId)) {
      throw new BadRequestException('channelId must be a Slack channel id');
    }

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.SLACK,
        },
      },
    });
    if (
      connection?.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.trim()
    ) {
      throw new BadRequestException(
        'Slack is not connected for this workspace',
      );
    }

    const meta = this.asMetadata(connection.metadataJson);
    const teamChannels = { ...(meta.teamChannels ?? {}) };
    const channelLabel = body.channelLabel?.trim() || undefined;
    teamChannels[teamId] = { channelId, channelLabel };
    const nextMeta: SlackMetadata = { ...meta, teamChannels };

    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: { metadataJson: nextMeta },
    });

    return this.getTeamChannel(teamId, user);
  }

  async clearTeamChannel(
    teamId: string,
    user: VerifiedUser,
  ): Promise<TeamSlackChannelDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.SLACK,
        },
      },
    });
    if (!connection) {
      return {
        channelId: null,
        channelLabel: null,
        isOverride: false,
        workspaceChannelId: null,
        workspaceChannelLabel: null,
        slackConnected: false,
      };
    }

    const meta = this.asMetadata(connection.metadataJson);
    if (meta.teamChannels?.[teamId]) {
      const teamChannels = { ...meta.teamChannels };
      delete teamChannels[teamId];
      const nextMeta: SlackMetadata = {
        ...meta,
        teamChannels:
          Object.keys(teamChannels).length > 0 ? teamChannels : undefined,
      };
      await this.prisma.addonConnection.update({
        where: { id: connection.id },
        data: { metadataJson: nextMeta },
      });
    }

    return this.getTeamChannel(teamId, user);
  }

  async postStandupDigest(params: {
    workspaceId: string;
    teamId?: string;
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
              toolKey: TOOL_KEYS.addonsSlack,
            },
          },
        }),
        this.prisma.addonConnection.findUnique({
          where: {
            workspaceId_provider: {
              workspaceId: params.workspaceId,
              provider: AddonProvider.SLACK,
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
      const target = this.resolveChannelForTeam(meta, params.teamId);
      const channel = target.channelLabel ? ` (${target.channelLabel})` : '';
      const text = [
        `*VibeStandup — ${params.teamName}${channel}*`,
        `_${params.entryDate}_`,
        '',
        params.content,
      ].join('\n');

      const mode = this.detectAuthMode(secretsRef, meta);
      if (mode === 'oauth' && secretsRef.startsWith('xoxb-')) {
        const posted = await this.postViaWebApi(
          secretsRef,
          target.channelId,
          text,
          params.workspaceId,
        );
        if (posted) {
          return true;
        }
        if (meta.incomingWebhookUrl) {
          this.logger.warn(
            `Slack chat.postMessage failed; falling back to Incoming Webhook for workspace ${params.workspaceId}`,
          );
          return this.postViaWebhook(
            meta.incomingWebhookUrl,
            text,
            params.workspaceId,
          );
        }
        return false;
      }

      return this.postViaWebhook(secretsRef, text, params.workspaceId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Slack digest post error for workspace ${params.workspaceId}: ${message}`,
      );
      return false;
    }
  }

  private async postViaWebApi(
    botToken: string,
    channelId: string | undefined,
    text: string,
    workspaceId: string,
  ): Promise<boolean> {
    if (!channelId) {
      this.logger.warn(
        `Slack OAuth digest skipped for workspace ${workspaceId}: missing channelId`,
      );
      return false;
    }

    const postOnce = async (): Promise<{ ok: boolean; error?: string }> => {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ channel: channelId, text }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        return { ok: false, error: json.error ?? String(res.status) };
      }
      return { ok: true };
    };

    let result = await postOnce();
    if (!result.ok && result.error === 'not_in_channel') {
      await this.tryJoinChannel(botToken, channelId, workspaceId);
      result = await postOnce();
    }
    if (!result.ok) {
      this.logger.warn(
        `Slack chat.postMessage failed for workspace ${workspaceId}: ${result.error}`,
      );
      return false;
    }
    return true;
  }

  private async tryJoinChannel(
    botToken: string,
    channelId: string,
    workspaceId: string,
  ): Promise<void> {
    try {
      const res = await fetch('https://slack.com/api/conversations.join', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ channel: channelId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!json.ok) {
        this.logger.warn(
          `Slack conversations.join failed for workspace ${workspaceId}: ${json.error ?? res.status}`,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Slack conversations.join error for workspace ${workspaceId}: ${message}`,
      );
    }
  }

  private async postViaWebhook(
    webhookUrl: string,
    text: string,
    workspaceId: string,
  ): Promise<boolean> {
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      this.logger.warn(
        `Slack digest skipped for workspace ${workspaceId}: unsupported secretsRef`,
      );
      return false;
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(
        `Slack digest post failed (${res.status}) for workspace ${workspaceId}: ${body.slice(0, 200)}`,
      );
      return false;
    }
    return true;
  }
}
