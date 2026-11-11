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
import type { MentionIssue } from '../mention-issue';
import {
  BitbucketConnectionDto,
  BitbucketOAuthStartDto,
} from './bitbucket.dto';

type BitbucketSecret = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

type BitbucketMetadata = {
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

type TokenJson = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

type WorkspacePage = {
  values?: Array<{ slug?: string; workspace?: { slug?: string } }>;
};

type RepoPage = {
  values?: Array<{ full_name?: string; has_issues?: boolean }>;
};

type IssuePage = {
  values?: Array<{
    id?: number;
    title?: string;
    state?: string;
    links?: { html?: { href?: string } };
  }>;
};

type UserJson = { username?: string; uuid?: string };

const STATE_TTL_MS = 15 * 60 * 1000;
const REPO_CACHE_MS = 10 * 60 * 1000;
const OPEN_STATES = '("new", "open", "on hold")';
const CLOSED = new Set([
  'resolved',
  'closed',
  'invalid',
  'duplicate',
  'wontfix',
]);
const API = 'https://api.bitbucket.org/2.0';
const TOKEN_URL = 'https://bitbucket.org/site/oauth2/access_token';

function storedMetadata(meta: BitbucketMetadata): BitbucketMetadata {
  return JSON.parse(JSON.stringify(meta)) as BitbucketMetadata;
}

function quoteUuid(raw: string | undefined): string | null {
  const bare = (raw ?? '').trim().replace(/^\{|\}$/g, '');
  if (!/^[0-9a-f-]{36}$/i.test(bare)) {
    return null;
  }
  return `{${bare}}`;
}

@Injectable()
export class BitbucketService {
  private readonly logger = new Logger(BitbucketService.name);
  private readonly repoCache = new Map<
    string,
    { at: number; repos: string[] }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  status(): AddonStatusDto {
    return { name: 'bitbucket', status: 'ready' };
  }

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for Bitbucket connections',
      );
    }
  }

  private clientId(): string | undefined {
    return process.env['BITBUCKET_CLIENT_ID']?.trim() || undefined;
  }

  private clientSecret(): string | undefined {
    return process.env['BITBUCKET_CLIENT_SECRET']?.trim() || undefined;
  }

  oauthConfigured(): boolean {
    return Boolean(this.clientId() && this.clientSecret());
  }

  private requireOAuthConfigured(): { clientId: string; clientSecret: string } {
    const clientId = this.clientId();
    const clientSecret = this.clientSecret();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Bitbucket OAuth is not configured (BITBUCKET_CLIENT_ID / BITBUCKET_CLIENT_SECRET)',
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
    const override = process.env['BITBUCKET_REDIRECT_URI']?.trim();
    if (override) {
      return override;
    }
    return `${this.publicApiBase()}/addons/bitbucket/oauth/callback`;
  }

  private standupAppOrigin(): string {
    return (
      process.env['PUBLIC_STANDUP_URL']?.trim().replace(/\/$/, '') ||
      'http://localhost:4201'
    );
  }

  workspaceRedirect(result: 'connected' | 'error', detail?: unknown): string {
    const url = new URL('/app/workspace', `${this.standupAppOrigin()}/`);
    url.searchParams.set('bitbucket', result);
    const detailText = this.asSingleString(detail);
    if (detailText) {
      url.searchParams.set('bitbucketDetail', detailText.slice(0, 120));
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

  private asMetadata(raw: unknown): BitbucketMetadata {
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
          provider: AddonProvider.BITBUCKET,
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
  ): Promise<BitbucketConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const [connection, tool] = await Promise.all([
      this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.BITBUCKET,
          },
        },
      }),
      this.prisma.workspaceTool.findUnique({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsBitbucket,
          },
        },
      }),
    ]);

    const meta = this.asMetadata(connection?.metadataJson);
    return {
      status: (connection?.status ??
        AddonConnectionStatus.DISCONNECTED) as BitbucketConnectionDto['status'],
      configured: Boolean(connection?.secretsRef?.trim()),
      accountLogin: meta.accountLogin ?? null,
      toolEnabled: tool?.enabled ?? false,
      oauthAvailable: this.oauthConfigured(),
    };
  }

  async startOAuth(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<BitbucketOAuthStartDto> {
    this.ensureDb();
    const { clientId } = this.requireOAuthConfigured();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const nonce = randomBytes(16).toString('hex');
    const exp = Date.now() + STATE_TTL_MS;
    const state = this.encodeOAuthState({ workspaceId, userId, exp, nonce });
    const pendingMeta: BitbucketMetadata = {
      oauthNonce: nonce,
      oauthExp: exp,
      oauthUserId: userId,
    };

    await this.prisma.addonConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.BITBUCKET,
        },
      },
      create: {
        workspaceId,
        provider: AddonProvider.BITBUCKET,
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
      response_type: 'code',
      state,
      redirect_uri: this.redirectUri(),
    });
    return {
      authorizeUrl: `https://bitbucket.org/site/oauth2/authorize?${params.toString()}`,
    };
  }

  async completeOAuthCallback(
    code: unknown,
    state: unknown,
    errorFromProvider: unknown,
  ): Promise<string> {
    const errorText = this.asSingleString(errorFromProvider);
    if (errorText) {
      this.logger.warn(`Bitbucket OAuth denied: ${errorText}`);
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
              provider: AddonProvider.BITBUCKET,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            provider: AddonProvider.BITBUCKET,
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
              toolKey: TOOL_KEYS.addonsBitbucket,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            toolKey: TOOL_KEYS.addonsBitbucket,
            enabled: true,
          },
          update: { enabled: true },
        }),
      ]);
      this.repoCache.delete(payload.workspaceId);
      return this.workspaceRedirect('connected');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Bitbucket OAuth callback error: ${message}`);
      return this.workspaceRedirect('error', 'callback_failed');
    }
  }

  async disconnect(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<BitbucketConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);
    const existing = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.BITBUCKET,
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
    this.repoCache.delete(workspaceId);
    return this.getConnection(workspaceId, user);
  }

  async searchMentionIssues(
    workspaceId: string,
    query: string,
  ): Promise<MentionIssue[]> {
    const text = query.replace(/["\\]/g, '').replace(/\s+/g, ' ').trim();
    if (text.length < 2) {
      return [];
    }
    const q = `(title ~ "${text}" OR content.raw ~ "${text}") AND state IN ${OPEN_STATES}`;
    return this.mentionIssues(workspaceId, async (token) => {
      const repos = await this.issueRepos(workspaceId, token);
      const pages = await Promise.all(
        repos.map((repo) => this.issues(token, repo, q)),
      );
      return pages.flat().slice(0, 8);
    });
  }

  async recentMentionIssues(workspaceId: string): Promise<MentionIssue[]> {
    return this.mentionIssues(workspaceId, async (token) => {
      const me = await this.apiGet<UserJson>(token, '/user');
      const uuid = quoteUuid(me?.uuid);
      if (!uuid) {
        return [];
      }
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, '+00:00');
      const q = `updated_on > ${since} AND state IN ${OPEN_STATES} AND (reporter.uuid = "${uuid}" OR assignee.uuid = "${uuid}")`;
      const repos = await this.issueRepos(workspaceId, token);
      const pages = await Promise.all(
        repos.map((repo) => this.issues(token, repo, q, '-updated_on')),
      );
      return pages.flat().slice(0, 8);
    });
  }

  private async mentionIssues(
    workspaceId: string,
    load: (token: string) => Promise<MentionIssue[]>,
  ): Promise<MentionIssue[]> {
    if (!this.prisma.isEnabled()) {
      return [];
    }
    const tool = await this.prisma.workspaceTool.findUnique({
      where: {
        workspaceId_toolKey: {
          workspaceId,
          toolKey: TOOL_KEYS.addonsBitbucket,
        },
      },
    });
    if (!tool?.enabled) {
      return [];
    }
    const token = await this.accessToken(workspaceId);
    if (!token) {
      return [];
    }
    try {
      return await load(token);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Bitbucket mention search failed: ${message}`);
      return [];
    }
  }

  private async issueRepos(
    workspaceId: string,
    token: string,
  ): Promise<string[]> {
    const cached = this.repoCache.get(workspaceId);
    if (cached && Date.now() - cached.at < REPO_CACHE_MS) {
      return cached.repos;
    }
    const workspaces = await this.apiGet<WorkspacePage>(
      token,
      '/user/workspaces?pagelen=10',
    );
    const slugs = (workspaces?.values ?? [])
      .flatMap((row) => {
        const slug = row.workspace?.slug || row.slug;
        return slug ? [slug] : [];
      })
      .slice(0, 4);
    const repos: string[] = [];
    for (const slug of slugs) {
      if (repos.length >= 8) {
        break;
      }
      const filtered = await this.apiGet<RepoPage>(
        token,
        `/repositories/${encodeURIComponent(slug)}?pagelen=20&q=${encodeURIComponent('has_issues = true')}`,
      );
      const page =
        filtered ??
        (await this.apiGet<RepoPage>(
          token,
          `/repositories/${encodeURIComponent(slug)}?pagelen=20`,
        ));
      for (const repo of page?.values ?? []) {
        if (repos.length >= 8) {
          break;
        }
        if (repo.full_name && repo.has_issues !== false) {
          repos.push(repo.full_name);
        }
      }
    }
    this.repoCache.set(workspaceId, { at: Date.now(), repos });
    return repos;
  }

  private async issues(
    token: string,
    fullName: string,
    q: string,
    sort?: string,
  ): Promise<MentionIssue[]> {
    const parts = fullName.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return [];
    }
    const sortParam = sort ? `&sort=${encodeURIComponent(sort)}` : '';
    const page = await this.apiGet<IssuePage>(
      token,
      `/repositories/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/issues?pagelen=5&q=${encodeURIComponent(q)}${sortParam}`,
    );
    const out: MentionIssue[] = [];
    for (const issue of page?.values ?? []) {
      const title = issue.title?.trim();
      const href = issue.links?.html?.href;
      const state = (issue.state ?? '').toLowerCase();
      if (
        typeof issue.id !== 'number' ||
        !title ||
        !href?.startsWith('https://') ||
        CLOSED.has(state)
      ) {
        continue;
      }
      out.push({
        provider: 'bitbucket',
        key: `${fullName}#${issue.id}`,
        title,
        url: href,
      });
    }
    return out;
  }

  private async accessToken(workspaceId: string): Promise<string | null> {
    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.BITBUCKET,
        },
      },
    });
    if (
      !connection ||
      connection.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.trim()
    ) {
      return null;
    }
    const secret = this.parseSecret(connection.secretsRef);
    if (!secret?.accessToken) {
      return null;
    }
    if (
      typeof secret.expiresAt !== 'number' ||
      secret.expiresAt - Date.now() > 60_000
    ) {
      return secret.accessToken;
    }
    if (!secret.refreshToken || !this.oauthConfigured()) {
      return null;
    }
    const { clientId, clientSecret } = this.requireOAuthConfigured();
    const refreshed = await this.exchangeToken({
      clientId,
      clientSecret,
      grantType: 'refresh_token',
      refreshToken: secret.refreshToken,
    });
    if (!refreshed.access_token) {
      return null;
    }
    const next: BitbucketSecret = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? secret.refreshToken,
      expiresAt:
        typeof refreshed.expires_in === 'number'
          ? Date.now() + refreshed.expires_in * 1000
          : undefined,
    };
    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: { secretsRef: this.serializeSecret(next) },
    });
    return next.accessToken;
  }

  private async fetchUsername(token: string): Promise<string | undefined> {
    const me = await this.apiGet<UserJson>(token, '/user');
    const name = me?.username?.trim();
    return name || undefined;
  }

  private async apiGet<T>(token: string, path: string): Promise<T | null> {
    const res = await fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  }

  private async exchangeToken(opts: {
    clientId: string;
    clientSecret: string;
    grantType: 'authorization_code' | 'refresh_token';
    code?: string;
    refreshToken?: string;
  }): Promise<TokenJson> {
    const body = new URLSearchParams({ grant_type: opts.grantType });
    if (opts.code) {
      body.set('code', opts.code);
      body.set('redirect_uri', this.redirectUri());
    }
    if (opts.refreshToken) {
      body.set('refresh_token', opts.refreshToken);
    }
    const basic = Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString(
      'base64',
    );
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as TokenJson;
    if (!res.ok || !json.access_token) {
      return { error: json.error || 'token_exchange_failed' };
    }
    return json;
  }

  private serializeSecret(secret: BitbucketSecret): string {
    return JSON.stringify(secret);
  }

  private parseSecret(raw: string): BitbucketSecret | null {
    try {
      const parsed = JSON.parse(raw) as BitbucketSecret;
      if (typeof parsed.accessToken !== 'string' || !parsed.accessToken) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
