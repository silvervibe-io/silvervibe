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
  TeamRole,
  WorkspaceRole,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { AddonStatusDto } from '../addon-status.dto';
import type { MentionIssue } from '../mention-issue';
import { mentionsToMarkdown } from '../../standups/mention-text';
import { readTeamTargetEntry, withTeamTargetEntry } from '../team-target-meta';
import {
  GithubConnectionDto,
  GithubIssueDto,
  GithubOAuthStartDto,
  GithubRepoDto,
  SelectGithubTargetDto,
  SetTeamGithubTargetDto,
  TeamGithubTargetDto,
} from './github.dto';

type GithubTeamTarget = {
  owner: string;
  repo: string;
  /** Standing "VibeStandup digests" issue. Not chosen by the user. */
  digestIssueNumber?: number;
};

type GithubSecret = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

type GithubMetadata = {
  accountLogin?: string;
  owner?: string;
  repo?: string;
  issueNumber?: number;
  issueTitle?: string;
  /** Standing digest issue in the workspace repository. */
  digestIssueNumber?: number;
  /** Per-team repository overrides; workspace target remains the default. */
  teamTargets?: Record<string, GithubTeamTarget>;
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

/** Prisma rejects JSON columns that contain `undefined`. */
function storedMetadata(meta: GithubMetadata): GithubMetadata {
  return JSON.parse(JSON.stringify(meta)) as GithubMetadata;
}

/** repo scope so digests can comment on private workspace repos. */
const OAUTH_SCOPES = 'repo';
const DIGEST_ISSUE_TITLE = 'VibeStandup digests';
const STATE_TTL_MS = 15 * 60 * 1000;
const API_BASE = 'https://api.github.com';
const API_VERSION = '2022-11-28';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly mentionScopes = new Map<
    string,
    { user: string; orgs: string[]; at: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  status(): AddonStatusDto {
    return { name: 'github', status: 'ready' };
  }

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for GitHub connections',
      );
    }
  }

  private githubClientId(): string | undefined {
    return process.env['GITHUB_CLIENT_ID']?.trim() || undefined;
  }

  private githubClientSecret(): string | undefined {
    return process.env['GITHUB_CLIENT_SECRET']?.trim() || undefined;
  }

  oauthConfigured(): boolean {
    return Boolean(this.githubClientId() && this.githubClientSecret());
  }

  private requireOAuthConfigured(): { clientId: string; clientSecret: string } {
    const clientId = this.githubClientId();
    const clientSecret = this.githubClientSecret();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'GitHub OAuth is not configured (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)',
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
    const override = process.env['GITHUB_REDIRECT_URI']?.trim();
    if (override) {
      return override;
    }
    return `${this.publicApiBase()}/addons/github/oauth/callback`;
  }

  private standupAppOrigin(): string {
    return (
      process.env['PUBLIC_STANDUP_URL']?.trim().replace(/\/$/, '') ||
      'http://localhost:4201'
    );
  }

  workspaceRedirect(result: 'connected' | 'error', detail?: unknown): string {
    const url = new URL('/app/workspace', `${this.standupAppOrigin()}/`);
    url.searchParams.set('github', result);
    const detailText = this.asSingleString(detail);
    if (detailText) {
      url.searchParams.set('githubDetail', detailText.slice(0, 120));
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

  private asMetadata(raw: unknown): GithubMetadata {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    const obj = raw as Record<string, unknown>;
    const str = (key: string): string | undefined => {
      const v = obj[key];
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const num = (key: string): number | undefined => {
      const v = obj[key];
      return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
    };
    const teamTargetsRaw = obj['teamTargets'];
    const teamTargets: Record<string, GithubTeamTarget> = {};
    if (
      teamTargetsRaw &&
      typeof teamTargetsRaw === 'object' &&
      !Array.isArray(teamTargetsRaw)
    ) {
      for (const [rawKey, value] of Object.entries(
        teamTargetsRaw as Record<string, unknown>,
      )) {
        if (
          rawKey === '__proto__' ||
          rawKey === 'constructor' ||
          rawKey === 'prototype' ||
          !/^[a-z0-9_-]{8,64}$/i.test(rawKey) ||
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value)
        ) {
          continue;
        }
        const entry = value as Record<string, unknown>;
        const owner =
          typeof entry['owner'] === 'string' && entry['owner'].trim()
            ? entry['owner'].trim()
            : undefined;
        const repo =
          typeof entry['repo'] === 'string' && entry['repo'].trim()
            ? entry['repo'].trim()
            : undefined;
        const digestIssueNumber =
          typeof entry['digestIssueNumber'] === 'number' &&
          Number.isFinite(entry['digestIssueNumber'])
            ? entry['digestIssueNumber']
            : undefined;
        if (!owner || !repo) {
          continue;
        }
        Object.defineProperty(teamTargets, rawKey, {
          value: { owner, repo, digestIssueNumber },
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
    return {
      accountLogin: str('accountLogin'),
      owner: str('owner'),
      repo: str('repo'),
      issueNumber: num('issueNumber'),
      issueTitle: str('issueTitle'),
      digestIssueNumber: num('digestIssueNumber'),
      teamTargets:
        Object.keys(teamTargets).length > 0 ? teamTargets : undefined,
      oauthNonce: str('oauthNonce'),
      oauthExp: num('oauthExp'),
      oauthUserId: str('oauthUserId'),
    };
  }

  resolveRepoForTeam(
    meta: GithubMetadata,
    teamId?: string,
  ): {
    owner?: string;
    repo?: string;
    digestIssueNumber?: number;
    isOverride: boolean;
  } {
    const override = readTeamTargetEntry(meta.teamTargets, teamId);
    if (override?.owner && override.repo) {
      return {
        owner: override.owner,
        repo: override.repo,
        digestIssueNumber: override.digestIssueNumber,
        isOverride: true,
      };
    }
    return {
      owner: meta.owner,
      repo: meta.repo,
      digestIssueNumber: meta.digestIssueNumber,
      isOverride: false,
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
          provider: AddonProvider.GITHUB,
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
  ): Promise<GithubConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const [connection, tool] = await Promise.all([
      this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.GITHUB,
          },
        },
      }),
      this.prisma.workspaceTool.findUnique({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsGithub,
          },
        },
      }),
    ]);

    const meta = this.asMetadata(connection?.metadataJson);
    const repoFullName =
      meta.owner && meta.repo ? `${meta.owner}/${meta.repo}` : null;
    return {
      status: (connection?.status ??
        AddonConnectionStatus.DISCONNECTED) as GithubConnectionDto['status'],
      configured: Boolean(connection?.secretsRef?.trim()),
      repoFullName,
      issueNumber: null,
      issueTitle: null,
      accountLogin: meta.accountLogin ?? null,
      toolEnabled: tool?.enabled ?? false,
      oauthAvailable: this.oauthConfigured(),
    };
  }

  async startOAuth(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<GithubOAuthStartDto> {
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
    const existing = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.GITHUB,
        },
      },
    });
    const pendingMeta: GithubMetadata = {
      ...this.asMetadata(existing?.metadataJson),
      oauthNonce: nonce,
      oauthExp: exp,
      oauthUserId: userId,
    };
    const keepToken =
      existing?.status === AddonConnectionStatus.CONNECTED &&
      Boolean(existing.secretsRef?.trim());

    await this.prisma.addonConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.GITHUB,
        },
      },
      create: {
        workspaceId,
        provider: AddonProvider.GITHUB,
        status: AddonConnectionStatus.PENDING,
        metadataJson: storedMetadata(pendingMeta),
      },
      update: keepToken
        ? { metadataJson: storedMetadata(pendingMeta) }
        : {
            status: AddonConnectionStatus.PENDING,
            metadataJson: storedMetadata(pendingMeta),
          },
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(),
      scope: OAUTH_SCOPES,
      state,
      allow_signup: 'false',
    });

    return {
      authorizeUrl: `https://github.com/login/oauth/authorize?${params.toString()}`,
    };
  }

  async completeOAuthCallback(
    code: unknown,
    state: unknown,
    errorFromGithub: unknown,
  ): Promise<string> {
    const errorText = this.asSingleString(errorFromGithub);
    if (errorText) {
      this.logger.warn(`GitHub OAuth denied: ${errorText}`);
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

      const tokenRes = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: codeText,
            redirect_uri: this.redirectUri(),
          }),
        },
      );
      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      };

      if (!tokenRes.ok || !tokenJson.access_token) {
        this.logger.warn(
          `GitHub token exchange failed: ${tokenJson.error ?? tokenRes.status} ${tokenJson.error_description ?? ''}`,
        );
        return this.workspaceRedirect(
          'error',
          tokenJson.error ?? 'token_exchange_failed',
        );
      }

      const accountLogin = await this.fetchLogin(tokenJson.access_token);
      const existing = await this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId: payload.workspaceId,
            provider: AddonProvider.GITHUB,
          },
        },
      });
      const previous = this.asMetadata(existing?.metadataJson);
      const metadataJson = storedMetadata({
        accountLogin,
        owner: previous.owner,
        repo: previous.repo,
        digestIssueNumber: previous.digestIssueNumber,
        teamTargets: previous.teamTargets,
      });
      const expiresAt =
        typeof tokenJson.expires_in === 'number'
          ? Date.now() + tokenJson.expires_in * 1000
          : undefined;

      await this.prisma.$transaction([
        this.prisma.addonConnection.upsert({
          where: {
            workspaceId_provider: {
              workspaceId: payload.workspaceId,
              provider: AddonProvider.GITHUB,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            provider: AddonProvider.GITHUB,
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: this.serializeSecret({
              accessToken: tokenJson.access_token,
              refreshToken: tokenJson.refresh_token,
              expiresAt,
            }),
            externalId: accountLogin ?? null,
            metadataJson,
          },
          update: {
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: this.serializeSecret({
              accessToken: tokenJson.access_token,
              refreshToken: tokenJson.refresh_token,
              expiresAt,
            }),
            externalId: accountLogin ?? null,
            metadataJson,
          },
        }),
        this.prisma.workspaceTool.upsert({
          where: {
            workspaceId_toolKey: {
              workspaceId: payload.workspaceId,
              toolKey: TOOL_KEYS.addonsGithub,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            toolKey: TOOL_KEYS.addonsGithub,
            enabled: true,
          },
          update: { enabled: true },
        }),
      ]);

      return this.workspaceRedirect('connected');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`GitHub OAuth callback error: ${message}`);
      return this.workspaceRedirect('error', 'callback_failed');
    }
  }

  async listRepos(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<GithubRepoDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);
    return this.fetchRepos(workspaceId);
  }

  async listReposForTeam(
    teamId: string,
    user: VerifiedUser,
  ): Promise<GithubRepoDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);
    return this.fetchRepos(workspaceId);
  }

  private async fetchRepos(workspaceId: string): Promise<GithubRepoDto[]> {
    const token = await this.requireAccessToken(workspaceId);

    const repos = await this.apiGet<
      Array<{ full_name: string; name: string; owner: { login: string } }>
    >(
      token,
      '/user/repos?per_page=50&sort=updated&affiliation=owner,collaborator,organization_member',
    );

    return repos.map((r) => ({
      fullName: r.full_name,
      owner: r.owner.login,
      name: r.name,
    }));
  }

  async listIssues(
    workspaceId: string,
    user: VerifiedUser,
    owner: string,
    repo: string,
  ): Promise<GithubIssueDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);
    return this.fetchIssues(workspaceId, owner, repo);
  }

  async listIssuesForTeam(
    teamId: string,
    user: VerifiedUser,
    owner: string,
    repo: string,
  ): Promise<GithubIssueDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);
    return this.fetchIssues(workspaceId, owner, repo);
  }

  private async fetchIssues(
    workspaceId: string,
    owner: string,
    repo: string,
  ): Promise<GithubIssueDto[]> {
    const token = await this.requireAccessToken(workspaceId);

    const ownerTrim = owner.trim();
    const repoTrim = repo.trim();
    if (!ownerTrim || !repoTrim) {
      throw new BadRequestException('owner and repo are required');
    }

    const issues = await this.apiGet<
      Array<{ number: number; title: string; pull_request?: unknown }>
    >(
      token,
      `/repos/${encodeURIComponent(ownerTrim)}/${encodeURIComponent(repoTrim)}/issues?state=open&per_page=50`,
    );

    return issues
      .filter((i) => !i.pull_request)
      .map((i) => ({ number: i.number, title: i.title }));
  }

  async selectTarget(
    workspaceId: string,
    user: VerifiedUser,
    body: SelectGithubTargetDto,
  ): Promise<GithubConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const owner = body.owner.trim();
    const repo = body.repo.trim();
    const token = await this.requireAccessToken(workspaceId);
    await this.requireRepository(token, owner, repo);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.GITHUB,
        },
      },
    });
    if (
      !connection ||
      connection.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.trim()
    ) {
      throw new BadRequestException('GitHub is not connected');
    }

    const meta = this.asMetadata(connection.metadataJson);
    const sameRepo = meta.owner === owner && meta.repo === repo;
    const metadataJson: GithubMetadata = {
      ...meta,
      owner,
      repo,
      issueNumber: undefined,
      issueTitle: undefined,
      digestIssueNumber: sameRepo ? meta.digestIssueNumber : undefined,
    };
    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: { metadataJson: storedMetadata(metadataJson) },
    });

    return this.getConnection(workspaceId, user);
  }

  async getTeamTarget(
    teamId: string,
    user: VerifiedUser,
  ): Promise<TeamGithubTargetDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.GITHUB,
        },
      },
    });
    const meta = this.asMetadata(connection?.metadataJson);
    const connected =
      connection?.status === AddonConnectionStatus.CONNECTED &&
      Boolean(connection.secretsRef?.trim());
    const resolved = this.resolveRepoForTeam(meta, teamId);
    return {
      owner: resolved.owner ?? null,
      repo: resolved.repo ?? null,
      issueNumber: null,
      issueTitle: null,
      isOverride: resolved.isOverride,
      workspaceOwner: meta.owner ?? null,
      workspaceRepo: meta.repo ?? null,
      workspaceIssueNumber: null,
      workspaceIssueTitle: null,
      githubConnected: connected,
    };
  }

  async setTeamTarget(
    teamId: string,
    user: VerifiedUser,
    body: SetTeamGithubTargetDto,
  ): Promise<TeamGithubTargetDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const owner = body.owner.trim();
    const repo = body.repo.trim();
    const token = await this.requireAccessToken(workspaceId);
    await this.requireRepository(token, owner, repo);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.GITHUB,
        },
      },
    });
    if (
      !connection ||
      connection.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.trim()
    ) {
      throw new BadRequestException(
        'GitHub is not connected for this workspace',
      );
    }

    const meta = this.asMetadata(connection.metadataJson);
    const previous = readTeamTargetEntry(meta.teamTargets, teamId);
    const sameRepo = previous?.owner === owner && previous?.repo === repo;
    const teamTargets = withTeamTargetEntry(meta.teamTargets, teamId, {
      owner,
      repo,
      digestIssueNumber: sameRepo ? previous?.digestIssueNumber : undefined,
    });
    const nextMeta: GithubMetadata = { ...meta, teamTargets };

    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: { metadataJson: storedMetadata(nextMeta) },
    });

    return this.getTeamTarget(teamId, user);
  }

  async clearTeamTarget(
    teamId: string,
    user: VerifiedUser,
  ): Promise<TeamGithubTargetDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.GITHUB,
        },
      },
    });
    if (!connection) {
      return {
        owner: null,
        repo: null,
        issueNumber: null,
        issueTitle: null,
        isOverride: false,
        workspaceOwner: null,
        workspaceRepo: null,
        workspaceIssueNumber: null,
        workspaceIssueTitle: null,
        githubConnected: false,
      };
    }

    const meta = this.asMetadata(connection.metadataJson);
    if (readTeamTargetEntry(meta.teamTargets, teamId)) {
      const teamTargets = withTeamTargetEntry(meta.teamTargets, teamId, null);
      const nextMeta: GithubMetadata = { ...meta, teamTargets };
      await this.prisma.addonConnection.update({
        where: { id: connection.id },
        data: { metadataJson: storedMetadata(nextMeta) },
      });
    }

    return this.getTeamTarget(teamId, user);
  }

  async disconnect(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<GithubConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const existing = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.GITHUB,
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
   * Posts standup summary as a GitHub issue comment.
   * Soft-fail: logs and returns false on any error (never throws to callers).
   */
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
              toolKey: TOOL_KEYS.addonsGithub,
            },
          },
        }),
        this.prisma.addonConnection.findUnique({
          where: {
            workspaceId_provider: {
              workspaceId: params.workspaceId,
              provider: AddonProvider.GITHUB,
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

      const meta = this.asMetadata(connection.metadataJson);
      const target = this.resolveRepoForTeam(meta, params.teamId);
      if (!target.owner || !target.repo) {
        this.logger.debug(
          `GitHub digest skipped for workspace ${params.workspaceId}: no repository`,
        );
        return false;
      }

      const token = await this.requireAccessToken(params.workspaceId);
      const issueNumber = await this.ensureDigestIssue(
        connection.id,
        meta,
        token,
        params.teamId,
        target.owner,
        target.repo,
        target.digestIssueNumber,
      );

      const body = [
        `### VibeStandup — ${params.teamName}`,
        `_${params.entryDate}_`,
        '',
        mentionsToMarkdown(params.content),
      ].join('\n');

      const res = await fetch(
        `${API_BASE}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          headers: this.apiHeaders(token),
          body: JSON.stringify({ body }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(
          `GitHub issue comment failed (${res.status}) for workspace ${params.workspaceId}: ${text.slice(0, 200)}`,
        );
        return false;
      }
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `GitHub digest post error for workspace ${params.workspaceId}: ${message}`,
      );
      return false;
    }
  }

  async searchMentionIssues(
    workspaceId: string,
    query: string,
  ): Promise<MentionIssue[]> {
    if (!this.prisma.isEnabled()) {
      return [];
    }
    try {
      const token = await this.mentionToken(
        workspaceId,
        TOOL_KEYS.addonsGithub,
      );
      if (!token) {
        return [];
      }
      const text = query.replace(/[\r\n]/g, ' ').trim();
      const scope = await this.mentionScope(workspaceId, token);
      if (!text || !scope) {
        return [];
      }
      const allowed = new Set(
        [scope.user, ...scope.orgs].map((name) => name.toLowerCase()),
      );
      const qualifiers = [
        `user:${scope.user}`,
        ...scope.orgs.slice(0, 4).map((org) => `org:${org}`),
      ];
      const batches = await Promise.all(
        qualifiers.map((qualifier) =>
          this.searchIssues(token, `${text} is:issue ${qualifier}`),
        ),
      );
      const issues: MentionIssue[] = [];
      const seen = new Set<string>();
      for (const item of batches.flat()) {
        if (issues.length >= 8) {
          break;
        }
        if (
          item.pull_request ||
          !item.html_url?.startsWith('https://') ||
          !item.number
        ) {
          continue;
        }
        const repo = /\/repos\/([^/]+)\/([^/]+)$/.exec(
          item.repository_url ?? '',
        );
        if (!repo || !allowed.has(repo[1].toLowerCase())) {
          continue;
        }
        const key = `${repo[1]}/${repo[2]}#${item.number}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        issues.push({
          provider: 'github',
          key,
          title: (item.title ?? key).slice(0, 200),
          url: item.html_url,
        });
      }
      return issues;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `GitHub issue search failed for workspace ${workspaceId}: ${message}`,
      );
      return [];
    }
  }

  /** Account and org logins whose repositories may appear in # search. */
  private async mentionScope(
    workspaceId: string,
    token: string,
  ): Promise<{ user: string; orgs: string[] } | null> {
    const cached = this.mentionScopes.get(workspaceId);
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
      return { user: cached.user, orgs: cached.orgs };
    }
    const me = await this.apiGet<{ login?: string }>(token, '/user');
    const login = me.login?.trim();
    if (!login || !/^[A-Za-z0-9-]+$/.test(login)) {
      return null;
    }
    let orgs: Array<{ login?: string }> = [];
    try {
      orgs = await this.apiGet<Array<{ login?: string }>>(
        token,
        '/user/orgs?per_page=100',
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `GitHub org list failed for workspace ${workspaceId}: ${message}`,
      );
    }
    const orgLogins = orgs.flatMap((org) => {
      const name = org.login?.trim();
      return name && /^[A-Za-z0-9-]+$/.test(name) ? [name] : [];
    });
    const scope = { user: login, orgs: orgLogins, at: Date.now() };
    this.mentionScopes.set(workspaceId, scope);
    return { user: login, orgs: orgLogins };
  }

  private async searchIssues(
    token: string,
    query: string,
  ): Promise<
    Array<{
      number?: number;
      title?: string;
      html_url?: string;
      pull_request?: unknown;
      repository_url?: string;
    }>
  > {
    try {
      const data = await this.apiGet<{
        items?: Array<{
          number?: number;
          title?: string;
          html_url?: string;
          pull_request?: unknown;
          repository_url?: string;
        }>;
      }>(token, `/search/issues?q=${encodeURIComponent(query)}&per_page=8`);
      return data.items ?? [];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`GitHub issue search failed: ${message}`);
      return [];
    }
  }

  private async mentionToken(
    workspaceId: string,
    toolKey: string,
  ): Promise<string | null> {
    const [tool, connection] = await Promise.all([
      this.prisma.workspaceTool.findUnique({
        where: { workspaceId_toolKey: { workspaceId, toolKey } },
      }),
      this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.GITHUB,
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

  private async requireAccessToken(workspaceId: string): Promise<string> {
    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.GITHUB,
        },
      },
    });
    if (
      !connection ||
      connection.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.trim()
    ) {
      throw new UnauthorizedException('github.token');
    }
    return this.tokenFromConnection(connection);
  }

  private parseSecret(raw: string): GithubSecret {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as Partial<GithubSecret>;
        if (
          typeof parsed.accessToken === 'string' &&
          parsed.accessToken.trim()
        ) {
          return {
            accessToken: parsed.accessToken.trim(),
            refreshToken: parsed.refreshToken?.trim() || undefined,
            expiresAt:
              typeof parsed.expiresAt === 'number'
                ? parsed.expiresAt
                : undefined,
          };
        }
      } catch {
        // Older rows store the access token as plain text.
      }
    }
    return { accessToken: trimmed };
  }

  private serializeSecret(secret: GithubSecret): string {
    if (!secret.refreshToken && secret.expiresAt === undefined) {
      return secret.accessToken;
    }
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
      throw new UnauthorizedException('github.token');
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
    secret: GithubSecret,
  ): Promise<string> {
    if (!secret.refreshToken) {
      throw new UnauthorizedException('github.token');
    }
    const { clientId, clientSecret } = this.requireOAuthConfigured();
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: secret.refreshToken,
      }),
    });
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!res.ok || !json.access_token) {
      throw new UnauthorizedException('github.token');
    }
    const next: GithubSecret = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token?.trim() || secret.refreshToken,
      expiresAt:
        typeof json.expires_in === 'number'
          ? Date.now() + json.expires_in * 1000
          : undefined,
    };
    await this.prisma.addonConnection.update({
      where: { id: connectionId },
      data: { secretsRef: this.serializeSecret(next) },
    });
    return next.accessToken;
  }

  private async requireRepository(
    token: string,
    owner: string,
    repo: string,
  ): Promise<void> {
    const repository = await this.apiGet<{ full_name?: string }>(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    );
    if (!repository?.full_name) {
      throw new BadRequestException('GitHub repository not found');
    }
  }

  private async ensureDigestIssue(
    connectionId: string,
    meta: GithubMetadata,
    token: string,
    teamId: string | undefined,
    owner: string,
    repo: string,
    existing: number | undefined,
  ): Promise<number> {
    if (existing) {
      const current = await this.apiGetStatus<{
        number?: number;
        title?: string;
        pull_request?: unknown;
      }>(
        token,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${existing}`,
      );
      if (
        current.body?.number &&
        !current.body.pull_request &&
        current.body.title === DIGEST_ISSUE_TITLE
      ) {
        return current.body.number;
      }
    }
    const query = `repo:${owner}/${repo} is:issue is:open in:title "${DIGEST_ISSUE_TITLE}"`;
    const search = await this.apiGet<{
      items?: Array<{
        number?: number;
        title?: string;
        pull_request?: unknown;
      }>;
    }>(token, `/search/issues?q=${encodeURIComponent(query)}&per_page=5`);
    const found = (search.items ?? []).find(
      (item) =>
        item.number && !item.pull_request && item.title === DIGEST_ISSUE_TITLE,
    );
    const number =
      found?.number ?? (await this.createDigestIssue(token, owner, repo));
    await this.saveDigestIssueNumber(
      connectionId,
      meta,
      teamId,
      owner,
      repo,
      number,
    );
    return number;
  }

  private async createDigestIssue(
    token: string,
    owner: string,
    repo: string,
  ): Promise<number> {
    const res = await fetch(
      `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      {
        method: 'POST',
        headers: this.apiHeaders(token),
        body: JSON.stringify({
          title: DIGEST_ISSUE_TITLE,
          body: 'Daily VibeStandup summaries are posted on this issue as comments.',
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(
        `GitHub digest issue create failed (${res.status}): ${text.slice(0, 200)}`,
      );
      if (res.status === 401 || res.status === 403) {
        throw new UnauthorizedException('github.token');
      }
      throw new BadGatewayException('github.request');
    }
    const created = (await res.json()) as { number?: number };
    if (!created.number) {
      throw new BadGatewayException('github.request');
    }
    return created.number;
  }

  private async saveDigestIssueNumber(
    connectionId: string,
    meta: GithubMetadata,
    teamId: string | undefined,
    owner: string,
    repo: string,
    number: number,
  ): Promise<void> {
    const override = teamId
      ? readTeamTargetEntry(meta.teamTargets, teamId)
      : undefined;
    const next: GithubMetadata =
      override?.owner === owner && override.repo === repo && teamId
        ? {
            ...meta,
            teamTargets: withTeamTargetEntry(meta.teamTargets, teamId, {
              owner,
              repo,
              digestIssueNumber: number,
            }),
          }
        : { ...meta, digestIssueNumber: number };
    await this.prisma.addonConnection.update({
      where: { id: connectionId },
      data: { metadataJson: storedMetadata(next) },
    });
  }

  private apiHeaders(token: string): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
      'Content-Type': 'application/json',
      'User-Agent': 'silvervibe-api',
    };
  }

  private async apiGet<T>(token: string, path: string): Promise<T> {
    const result = await this.apiGetStatus<T>(token, path);
    if (!result.body) {
      throw new BadGatewayException('github.request');
    }
    return result.body;
  }

  private async apiGetStatus<T>(
    token: string,
    path: string,
  ): Promise<{ body: T | null }> {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: this.apiHeaders(token),
    });
    if (res.status === 404) {
      return { body: null };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(
        `GitHub API ${path} failed (${res.status}): ${text.slice(0, 200)}`,
      );
      if (res.status === 401 || res.status === 403) {
        throw new UnauthorizedException('github.token');
      }
      throw new BadGatewayException('github.request');
    }
    return { body: (await res.json()) as T };
  }

  private async fetchLogin(token: string): Promise<string | undefined> {
    try {
      const me = await this.apiGet<{ login?: string }>(token, '/user');
      return me.login?.trim() || undefined;
    } catch {
      return undefined;
    }
  }
}
