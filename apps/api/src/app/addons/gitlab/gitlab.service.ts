import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
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
import type { MentionIssue } from '../mention-issue';
import { GitlabConnectionDto, GitlabOAuthStartDto } from './gitlab.dto';

type GitlabSecret = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

type GitlabMetadata = {
  accountLogin?: string;
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

type GitlabIssue = {
  iid?: number;
  title?: string;
  state?: string;
  web_url?: string;
  references?: { full?: string };
};

/** Prisma rejects JSON columns that contain `undefined`. */
function storedMetadata(meta: GitlabMetadata): GitlabMetadata {
  return JSON.parse(JSON.stringify(meta)) as GitlabMetadata;
}

/** Read-only. GitLab.com blocks instance-wide `scope=all` on /issues. */
const OAUTH_SCOPES = 'read_api read_user';
const STATE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_BASE = 'https://gitlab.com';

@Injectable()
export class GitlabService {
  private readonly logger = new Logger(GitlabService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  status(): AddonStatusDto {
    return { name: 'gitlab', status: 'ready' };
  }

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for GitLab connections',
      );
    }
  }

  private clientId(): string | undefined {
    return process.env['GITLAB_CLIENT_ID']?.trim() || undefined;
  }

  private clientSecret(): string | undefined {
    return process.env['GITLAB_CLIENT_SECRET']?.trim() || undefined;
  }

  oauthConfigured(): boolean {
    return Boolean(this.clientId() && this.clientSecret());
  }

  private requireOAuthConfigured(): { clientId: string; clientSecret: string } {
    const clientId = this.clientId();
    const clientSecret = this.clientSecret();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'GitLab OAuth is not configured (GITLAB_CLIENT_ID / GITLAB_CLIENT_SECRET)',
      );
    }
    return { clientId, clientSecret };
  }

  /** GitLab host. `GITLAB_BASE_URL` overrides gitlab.com for a self-managed instance. */
  private baseUrl(): string {
    const raw = process.env['GITLAB_BASE_URL']?.trim() || DEFAULT_BASE;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return DEFAULT_BASE;
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
      return DEFAULT_BASE;
    }
    return url.origin;
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
    const override = process.env['GITLAB_REDIRECT_URI']?.trim();
    if (override) {
      return override;
    }
    return `${this.publicApiBase()}/addons/gitlab/oauth/callback`;
  }

  private standupAppOrigin(): string {
    return (
      process.env['PUBLIC_STANDUP_URL']?.trim().replace(/\/$/, '') ||
      'http://localhost:4201'
    );
  }

  workspaceRedirect(result: 'connected' | 'error', detail?: unknown): string {
    const url = new URL('/app/workspace', `${this.standupAppOrigin()}/`);
    url.searchParams.set('gitlab', result);
    const detailText = this.asSingleString(detail);
    if (detailText) {
      url.searchParams.set('gitlabDetail', detailText.slice(0, 120));
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

  private asMetadata(raw: unknown): GitlabMetadata {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    const obj = raw as Record<string, unknown>;
    const str = (key: string): string | undefined => {
      const value = obj[key];
      return typeof value === 'string' && value.trim()
        ? value.trim()
        : undefined;
    };
    const num = (key: string): number | undefined => {
      const value = obj[key];
      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
    };
    return {
      accountLogin: str('accountLogin'),
      oauthNonce: str('oauthNonce'),
      oauthExp: num('oauthExp'),
      oauthUserId: str('oauthUserId'),
    };
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
          provider: AddonProvider.GITLAB,
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
  ): Promise<GitlabConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const [connection, tool] = await Promise.all([
      this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.GITLAB,
          },
        },
      }),
      this.prisma.workspaceTool.findUnique({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsGitlab,
          },
        },
      }),
    ]);

    const meta = this.asMetadata(connection?.metadataJson);
    return {
      status: (connection?.status ??
        AddonConnectionStatus.DISCONNECTED) as GitlabConnectionDto['status'],
      configured: Boolean(connection?.secretsRef?.trim()),
      accountLogin: meta.accountLogin ?? null,
      toolEnabled: tool?.enabled ?? false,
      oauthAvailable: this.oauthConfigured(),
    };
  }

  async startOAuth(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<GitlabOAuthStartDto> {
    this.ensureDb();
    const { clientId } = this.requireOAuthConfigured();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const nonce = randomBytes(16).toString('hex');
    const exp = Date.now() + STATE_TTL_MS;
    const state = this.encodeOAuthState({ workspaceId, userId, exp, nonce });
    const pendingMeta: GitlabMetadata = {
      oauthNonce: nonce,
      oauthExp: exp,
      oauthUserId: userId,
    };

    await this.prisma.addonConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.GITLAB,
        },
      },
      create: {
        workspaceId,
        provider: AddonProvider.GITLAB,
        status: AddonConnectionStatus.PENDING,
        metadataJson: storedMetadata(pendingMeta),
      },
      update: {
        status: AddonConnectionStatus.PENDING,
        metadataJson: storedMetadata(pendingMeta),
      },
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      state,
      scope: OAUTH_SCOPES,
    });
    return {
      authorizeUrl: `${this.baseUrl()}/oauth/authorize?${params.toString()}`,
    };
  }

  async completeOAuthCallback(
    code: unknown,
    state: unknown,
    errorFromGitlab: unknown,
  ): Promise<string> {
    const errorText = this.asSingleString(errorFromGitlab);
    if (errorText) {
      this.logger.warn(`GitLab OAuth denied: ${errorText}`);
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
      const tokenJson = await this.exchangeToken({
        clientId,
        clientSecret,
        grantType: 'authorization_code',
        code: codeText,
      });
      if (!tokenJson.access_token) {
        return this.workspaceRedirect(
          'error',
          tokenJson.error ?? 'token_exchange_failed',
        );
      }
      const accountLogin = await this.fetchUsername(tokenJson.access_token);
      const expiresAt =
        typeof tokenJson.expires_in === 'number'
          ? Date.now() + tokenJson.expires_in * 1000
          : undefined;
      const secretsRef = this.serializeSecret({
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        expiresAt,
      });

      await this.prisma.$transaction([
        this.prisma.addonConnection.upsert({
          where: {
            workspaceId_provider: {
              workspaceId: payload.workspaceId,
              provider: AddonProvider.GITLAB,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            provider: AddonProvider.GITLAB,
            status: AddonConnectionStatus.CONNECTED,
            secretsRef,
            externalId: accountLogin ?? null,
            metadataJson: storedMetadata({ accountLogin }),
          },
          update: {
            status: AddonConnectionStatus.CONNECTED,
            secretsRef,
            externalId: accountLogin ?? null,
            metadataJson: storedMetadata({ accountLogin }),
          },
        }),
        this.prisma.workspaceTool.upsert({
          where: {
            workspaceId_toolKey: {
              workspaceId: payload.workspaceId,
              toolKey: TOOL_KEYS.addonsGitlab,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            toolKey: TOOL_KEYS.addonsGitlab,
            enabled: true,
          },
          update: { enabled: true },
        }),
      ]);
      return this.workspaceRedirect('connected');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`GitLab OAuth callback error: ${message}`);
      return this.workspaceRedirect('error', 'callback_failed');
    }
  }

  async disconnect(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<GitlabConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);
    const existing = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.GITLAB,
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

  async searchMentionIssues(
    workspaceId: string,
    query: string,
  ): Promise<MentionIssue[]> {
    const text = query.replace(/[\r\n]/g, ' ').trim();
    if (!text) {
      return [];
    }
    return this.mentionIssues(workspaceId, async (token) => {
      const searched = await this.apiGet<GitlabIssue[]>(
        token,
        `/search?scope=issues&search=${encodeURIComponent(text)}&per_page=20`,
      );
      if (searched !== null) {
        return this.toMentions(searched);
      }
      const [authored, assigned] = await Promise.all([
        this.apiGet<GitlabIssue[]>(
          token,
          `/issues?scope=created_by_me&state=opened&search=${encodeURIComponent(text)}&per_page=8`,
        ),
        this.apiGet<GitlabIssue[]>(
          token,
          `/issues?scope=assigned_to_me&state=opened&search=${encodeURIComponent(text)}&per_page=8`,
        ),
      ]);
      return this.toMentions([...(authored ?? []), ...(assigned ?? [])]);
    });
  }

  async recentMentionIssues(workspaceId: string): Promise<MentionIssue[]> {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    return this.mentionIssues(workspaceId, async (token) => {
      const updated = encodeURIComponent(since);
      const [authored, assigned] = await Promise.all([
        this.apiGet<GitlabIssue[]>(
          token,
          `/issues?scope=created_by_me&state=opened&order_by=updated_at&sort=desc&updated_after=${updated}&per_page=8`,
        ),
        this.apiGet<GitlabIssue[]>(
          token,
          `/issues?scope=assigned_to_me&state=opened&order_by=updated_at&sort=desc&updated_after=${updated}&per_page=8`,
        ),
      ]);
      return this.toMentions([...(authored ?? []), ...(assigned ?? [])]);
    });
  }

  private async mentionIssues(
    workspaceId: string,
    load: (token: string) => Promise<MentionIssue[]>,
  ): Promise<MentionIssue[]> {
    if (!this.prisma.isEnabled()) {
      return [];
    }
    try {
      const token = await this.mentionToken(workspaceId);
      if (!token) {
        return [];
      }
      return await load(token);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `GitLab issue search failed for workspace ${workspaceId}: ${message}`,
      );
      return [];
    }
  }

  private toMentions(rows: GitlabIssue[]): MentionIssue[] {
    const issues: MentionIssue[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (issues.length >= 8) {
        break;
      }
      if (row.state && row.state !== 'opened') {
        continue;
      }
      const url = row.web_url?.trim() ?? '';
      const key = this.issueKey(url, row.iid, row.references?.full);
      if (!key || !url.startsWith('https://') || seen.has(key)) {
        continue;
      }
      seen.add(key);
      issues.push({
        provider: 'gitlab',
        key,
        title: (row.title?.trim() || key).slice(0, 200),
        url,
      });
    }
    return issues;
  }

  private issueKey(
    webUrl: string,
    iid: number | undefined,
    fullReference: string | undefined,
  ): string | null {
    const reference = fullReference?.trim();
    if (reference?.includes('#') && reference.length <= 200) {
      return reference;
    }
    const match =
      /^https:\/\/[^/]+\/(.+)\/-\/(?:issues|work_items)\/(\d+)(?:[/?#]|$)/.exec(
        webUrl,
      );
    if (match) {
      return `${match[1]}#${match[2]}`.slice(0, 200);
    }
    if (iid && webUrl.startsWith('https://')) {
      return `#${iid}`;
    }
    return null;
  }

  private async mentionToken(workspaceId: string): Promise<string | null> {
    const [tool, connection] = await Promise.all([
      this.prisma.workspaceTool.findUnique({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsGitlab,
          },
        },
      }),
      this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.GITLAB,
          },
        },
      }),
    ]);
    if (!tool?.enabled) {
      return null;
    }
    if (
      connection?.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.trim()
    ) {
      return null;
    }
    return this.tokenFromConnection(connection);
  }

  private parseSecret(raw: string): GitlabSecret {
    try {
      const parsed = JSON.parse(raw) as Partial<GitlabSecret>;
      if (typeof parsed.accessToken === 'string' && parsed.accessToken.trim()) {
        return {
          accessToken: parsed.accessToken.trim(),
          refreshToken: parsed.refreshToken?.trim() || undefined,
          expiresAt:
            typeof parsed.expiresAt === 'number' ? parsed.expiresAt : undefined,
        };
      }
    } catch {
      // Token JSON is required because GitLab access tokens expire.
    }
    return { accessToken: '' };
  }

  private serializeSecret(secret: GitlabSecret): string {
    return JSON.stringify({
      accessToken: secret.accessToken,
      refreshToken: secret.refreshToken,
      expiresAt: secret.expiresAt,
    });
  }

  private async tokenFromConnection(connection: {
    id: string;
    secretsRef: string | null;
  }): Promise<string> {
    const secret = this.parseSecret(connection.secretsRef ?? '');
    if (!secret.accessToken) {
      throw new UnauthorizedException('gitlab.token');
    }
    if (
      secret.expiresAt !== undefined &&
      secret.expiresAt <= Date.now() + 60_000
    ) {
      return this.refreshSecret(connection.id, secret);
    }
    return secret.accessToken;
  }

  private async refreshSecret(
    connectionId: string,
    secret: GitlabSecret,
  ): Promise<string> {
    if (!secret.refreshToken) {
      throw new UnauthorizedException('gitlab.token');
    }
    const { clientId, clientSecret } = this.requireOAuthConfigured();
    const tokenJson = await this.exchangeToken({
      clientId,
      clientSecret,
      grantType: 'refresh_token',
      refreshToken: secret.refreshToken,
    });
    if (!tokenJson.access_token) {
      throw new UnauthorizedException('gitlab.token');
    }
    const next: GitlabSecret = {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token?.trim() || secret.refreshToken,
      expiresAt:
        typeof tokenJson.expires_in === 'number'
          ? Date.now() + tokenJson.expires_in * 1000
          : undefined,
    };
    await this.prisma.addonConnection.update({
      where: { id: connectionId },
      data: { secretsRef: this.serializeSecret(next) },
    });
    return next.accessToken;
  }

  private async exchangeToken(input: {
    clientId: string;
    clientSecret: string;
    grantType: 'authorization_code' | 'refresh_token';
    code?: string;
    refreshToken?: string;
  }): Promise<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  }> {
    const body = new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: input.grantType,
      redirect_uri: this.redirectUri(),
    });
    if (input.code) {
      body.set('code', input.code);
    }
    if (input.refreshToken) {
      body.set('refresh_token', input.refreshToken);
    }
    const res = await fetch(`${this.baseUrl()}/oauth/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !json.access_token) {
      this.logger.warn(
        `GitLab token exchange failed: ${json.error ?? res.status} ${json.error_description ?? ''}`,
      );
    }
    return json;
  }

  private async fetchUsername(token: string): Promise<string | undefined> {
    try {
      const me = await this.apiGet<{ username?: string }>(token, '/user');
      return me?.username?.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Returns the JSON body, `null` when GitLab rejects the route (400),
   * and throws on auth or upstream failures.
   */
  private async apiGet<T>(token: string, path: string): Promise<T | null> {
    const res = await fetch(`${this.baseUrl()}/api/v4${path}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.status === 400) {
      return null;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(
        `GitLab API ${path} failed (${res.status}): ${text.slice(0, 200)}`,
      );
      if (res.status === 401 || res.status === 403) {
        throw new UnauthorizedException('gitlab.token');
      }
      throw new BadGatewayException('gitlab.request');
    }
    return (await res.json()) as T;
  }
}
