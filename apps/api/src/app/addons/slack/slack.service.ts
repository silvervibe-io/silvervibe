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
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { AddonStatusDto } from '../addon-status.dto';
import {
  ConnectSlackDto,
  SlackConnectionDto,
  SlackOAuthStartDto,
} from './slack.dto';

type SlackAuthMode = 'oauth' | 'webhook';

type SlackMetadata = {
  channelLabel?: string;
  channelId?: string;
  teamId?: string;
  teamName?: string;
  authMode?: SlackAuthMode;
};

type OAuthStatePayload = {
  workspaceId: string;
  userId: string;
  exp: number;
  nonce: string;
};

const OAUTH_SCOPES = [
  'chat:write',
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

  workspaceRedirect(result: 'connected' | 'error', detail?: string): string {
    const url = new URL('/app/workspace', `${this.standupAppOrigin()}/`);
    url.searchParams.set('slack', result);
    if (detail) {
      url.searchParams.set('slackDetail', detail.slice(0, 120));
    }
    return url.toString();
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
    return {
      channelLabel: str('channelLabel'),
      channelId: str('channelId'),
      teamId: str('teamId'),
      teamName: str('teamName'),
      authMode:
        authMode === 'oauth' || authMode === 'webhook' ? authMode : undefined,
    };
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

  private signState(payload: OAuthStatePayload): string {
    const { clientSecret } = this.requireOAuthConfigured();
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    );
    const sig = createHmac('sha256', clientSecret)
      .update(body)
      .digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state: string): OAuthStatePayload {
    const { clientSecret } = this.requireOAuthConfigured();
    const parts = state.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new BadRequestException('Invalid OAuth state');
    }
    const [body, sig] = parts;
    const expected = createHmac('sha256', clientSecret)
      .update(body)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid OAuth state signature');
    }
    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as OAuthStatePayload;
    } catch {
      throw new BadRequestException('Invalid OAuth state payload');
    }
    if (
      !payload.workspaceId ||
      !payload.userId ||
      typeof payload.exp !== 'number'
    ) {
      throw new BadRequestException('Invalid OAuth state fields');
    }
    if (Date.now() > payload.exp) {
      throw new BadRequestException('OAuth state expired');
    }
    return payload;
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

    const state = this.signState({
      workspaceId,
      userId,
      exp: Date.now() + STATE_TTL_MS,
      nonce: randomBytes(8).toString('hex'),
    });

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
        metadataJson: { authMode: 'oauth' },
      },
      update: {
        status: AddonConnectionStatus.PENDING,
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
    code: string | undefined,
    state: string | undefined,
    errorFromSlack: string | undefined,
  ): Promise<string> {
    if (errorFromSlack) {
      this.logger.warn(`Slack OAuth denied: ${errorFromSlack}`);
      return this.workspaceRedirect('error', errorFromSlack);
    }
    if (!code?.trim() || !state?.trim()) {
      return this.workspaceRedirect('error', 'missing_code_or_state');
    }

    try {
      this.ensureDb();
      const { clientId, clientSecret } = this.requireOAuthConfigured();
      const payload = this.verifyState(state.trim());
      await this.requireWorkspaceAdmin(payload.workspaceId, payload.userId);

      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code.trim(),
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
      const channel = meta.channelLabel ? ` (${meta.channelLabel})` : '';
      const text = [
        `*VibeStandup — ${params.teamName}${channel}*`,
        `_${params.entryDate}_`,
        '',
        params.content,
      ].join('\n');

      const mode = this.detectAuthMode(secretsRef, meta);
      if (mode === 'oauth' && secretsRef.startsWith('xoxb-')) {
        return this.postViaWebApi(
          secretsRef,
          meta.channelId,
          text,
          params.workspaceId,
        );
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
      this.logger.warn(
        `Slack chat.postMessage failed for workspace ${workspaceId}: ${json.error ?? res.status}`,
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
