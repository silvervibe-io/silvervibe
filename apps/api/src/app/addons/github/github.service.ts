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
  issueNumber: number;
  issueTitle?: string;
};

type GithubMetadata = {
  accountLogin?: string;
  owner?: string;
  repo?: string;
  issueNumber?: number;
  issueTitle?: string;
  /** Per-team issue overrides; workspace target remains the default. */
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

/** repo scope so digests can comment on private workspace repos. */
const OAUTH_SCOPES = 'repo';
const STATE_TTL_MS = 15 * 60 * 1000;
const API_BASE = 'https://api.github.com';
const API_VERSION = '2022-11-28';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

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
        const issueNumber =
          typeof entry['issueNumber'] === 'number' &&
          Number.isFinite(entry['issueNumber'])
            ? entry['issueNumber']
            : undefined;
        if (!owner || !repo || issueNumber === undefined) {
          continue;
        }
        const issueTitle =
          typeof entry['issueTitle'] === 'string' && entry['issueTitle'].trim()
            ? entry['issueTitle'].trim()
            : undefined;
        Object.defineProperty(teamTargets, rawKey, {
          value: { owner, repo, issueNumber, issueTitle },
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
      teamTargets:
        Object.keys(teamTargets).length > 0 ? teamTargets : undefined,
      oauthNonce: str('oauthNonce'),
      oauthExp: num('oauthExp'),
      oauthUserId: str('oauthUserId'),
    };
  }

  resolveIssueForTeam(
    meta: GithubMetadata,
    teamId?: string,
  ): {
    owner?: string;
    repo?: string;
    issueNumber?: number;
    issueTitle?: string;
    isOverride: boolean;
  } {
    const override = readTeamTargetEntry(meta.teamTargets, teamId);
    if (override?.owner && override.repo && override.issueNumber) {
      return {
        owner: override.owner,
        repo: override.repo,
        issueNumber: override.issueNumber,
        issueTitle: override.issueTitle,
        isOverride: true,
      };
    }
    return {
      owner: meta.owner,
      repo: meta.repo,
      issueNumber: meta.issueNumber,
      issueTitle: meta.issueTitle,
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
      issueNumber: meta.issueNumber ?? null,
      issueTitle: meta.issueTitle ?? null,
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
    const pendingMeta: GithubMetadata = {
      oauthNonce: nonce,
      oauthExp: exp,
      oauthUserId: userId,
    };

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
        metadataJson: pendingMeta,
      },
      update: {
        status: AddonConnectionStatus.PENDING,
        metadataJson: pendingMeta,
        secretsRef: null,
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
      const metadataJson: GithubMetadata = {
        accountLogin,
      };

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
            secretsRef: tokenJson.access_token,
            externalId: accountLogin ?? null,
            metadataJson,
          },
          update: {
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: tokenJson.access_token,
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
    const issueNumber = body.issueNumber;
    const token = await this.requireAccessToken(workspaceId);

    const issue = await this.apiGet<{ number: number; title: string }>(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
    );
    if (!issue?.number) {
      throw new BadRequestException('GitHub issue not found');
    }

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
    const metadataJson: GithubMetadata = {
      ...meta,
      owner,
      repo,
      issueNumber: issue.number,
      issueTitle: issue.title,
    };
    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: { metadataJson },
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
    const resolved = this.resolveIssueForTeam(meta, teamId);
    return {
      owner: resolved.owner ?? null,
      repo: resolved.repo ?? null,
      issueNumber: resolved.issueNumber ?? null,
      issueTitle: resolved.issueTitle ?? null,
      isOverride: resolved.isOverride,
      workspaceOwner: meta.owner ?? null,
      workspaceRepo: meta.repo ?? null,
      workspaceIssueNumber: meta.issueNumber ?? null,
      workspaceIssueTitle: meta.issueTitle ?? null,
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
    const issueNumber = body.issueNumber;
    const token = await this.requireAccessToken(workspaceId);

    const issue = await this.apiGet<{ number: number; title: string }>(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
    );
    if (!issue?.number) {
      throw new BadRequestException('GitHub issue not found');
    }

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
    const teamTargets = withTeamTargetEntry(meta.teamTargets, teamId, {
      owner,
      repo,
      issueNumber: issue.number,
      issueTitle: issue.title,
    });
    const nextMeta: GithubMetadata = { ...meta, teamTargets };

    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: { metadataJson: nextMeta },
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
        data: { metadataJson: nextMeta },
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
      const target = this.resolveIssueForTeam(meta, params.teamId);
      if (!target.owner || !target.repo || !target.issueNumber) {
        this.logger.debug(
          `GitHub digest skipped for workspace ${params.workspaceId}: no issue target`,
        );
        return false;
      }

      const body = [
        `### VibeStandup — ${params.teamName}`,
        `_${params.entryDate}_`,
        '',
        params.content,
      ].join('\n');

      const res = await fetch(
        `${API_BASE}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/issues/${target.issueNumber}/comments`,
        {
          method: 'POST',
          headers: this.apiHeaders(connection.secretsRef.trim()),
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
      throw new BadRequestException('GitHub is not connected');
    }
    return connection.secretsRef.trim();
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
    const res = await fetch(`${API_BASE}${path}`, {
      headers: this.apiHeaders(token),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `GitHub API ${path} failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    return (await res.json()) as T;
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
