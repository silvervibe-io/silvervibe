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
import { mentionsToAdf } from '../../standups/mention-text';
import { readTeamTargetEntry, withTeamTargetEntry } from '../team-target-meta';
import {
  JiraConnectionDto,
  JiraIssueDto,
  JiraOAuthStartDto,
  JiraProjectDto,
  JiraSiteDto,
  SelectJiraSiteDto,
  SelectJiraTargetDto,
  SetTeamJiraTargetDto,
  TeamJiraTargetDto,
} from './jira.dto';

type JiraTeamTarget = {
  cloudId: string;
  siteName?: string;
  projectKey: string;
  projectName?: string;
  /** Standing "VibeStandup digests" issue. Not chosen by the user. */
  digestIssueKey?: string;
};

type JiraMetadata = {
  refreshToken?: string;
  accessExpiresAt?: number;
  cloudId?: string;
  siteName?: string;
  siteUrl?: string;
  projectKey?: string;
  projectName?: string;
  issueKey?: string;
  issueSummary?: string;
  /** Standing digest issue in the workspace project. */
  digestIssueKey?: string;
  /** Per-team project overrides; workspace project remains the default. */
  teamTargets?: Record<string, JiraTeamTarget>;
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

const DIGEST_ISSUE_SUMMARY = 'VibeStandup digests';

/** Prisma rejects JSON columns that contain `undefined`. */
function storedMetadata(meta: JiraMetadata): JiraMetadata {
  return JSON.parse(JSON.stringify(meta)) as JiraMetadata;
}

function projectFromIssueKey(issueKey: string | undefined): string | undefined {
  const match = issueKey?.match(/^([A-Za-z][A-Za-z0-9_]*)-\d+$/);
  return match?.[1];
}

const OAUTH_SCOPES = [
  'read:jira-work',
  'write:jira-work',
  'offline_access',
].join(' ');
const STATE_TTL_MS = 15 * 60 * 1000;
const TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const AUTHORIZE_URL = 'https://auth.atlassian.com/authorize';
const RESOURCES_URL =
  'https://api.atlassian.com/oauth/token/accessible-resources';

@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  status(): AddonStatusDto {
    return { name: 'jira', status: 'ready' };
  }

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for Jira connections',
      );
    }
  }

  private jiraClientId(): string | undefined {
    return process.env['JIRA_CLIENT_ID']?.trim() || undefined;
  }

  private jiraClientSecret(): string | undefined {
    return process.env['JIRA_CLIENT_SECRET']?.trim() || undefined;
  }

  oauthConfigured(): boolean {
    return Boolean(this.jiraClientId() && this.jiraClientSecret());
  }

  private requireOAuthConfigured(): { clientId: string; clientSecret: string } {
    const clientId = this.jiraClientId();
    const clientSecret = this.jiraClientSecret();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Jira OAuth is not configured (JIRA_CLIENT_ID / JIRA_CLIENT_SECRET)',
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
    const override = process.env['JIRA_REDIRECT_URI']?.trim();
    if (override) {
      return override;
    }
    return `${this.publicApiBase()}/addons/jira/oauth/callback`;
  }

  private standupAppOrigin(): string {
    return (
      process.env['PUBLIC_STANDUP_URL']?.trim().replace(/\/$/, '') ||
      'http://localhost:4201'
    );
  }

  workspaceRedirect(result: 'connected' | 'error', detail?: unknown): string {
    const url = new URL('/app/workspace', `${this.standupAppOrigin()}/`);
    url.searchParams.set('jira', result);
    const detailText = this.asSingleString(detail);
    if (detailText) {
      url.searchParams.set('jiraDetail', detailText.slice(0, 120));
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

  private asMetadata(raw: unknown): JiraMetadata {
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
    const teamTargets: Record<string, JiraTeamTarget> = {};
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
        const cloudId =
          typeof entry['cloudId'] === 'string' && entry['cloudId'].trim()
            ? entry['cloudId'].trim()
            : undefined;
        const projectKey =
          typeof entry['projectKey'] === 'string' && entry['projectKey'].trim()
            ? entry['projectKey'].trim()
            : undefined;
        if (!cloudId || !projectKey) {
          continue;
        }
        const siteName =
          typeof entry['siteName'] === 'string' && entry['siteName'].trim()
            ? entry['siteName'].trim()
            : undefined;
        const projectName =
          typeof entry['projectName'] === 'string' &&
          entry['projectName'].trim()
            ? entry['projectName'].trim()
            : undefined;
        const digestIssueKey =
          typeof entry['digestIssueKey'] === 'string' &&
          entry['digestIssueKey'].trim()
            ? entry['digestIssueKey'].trim()
            : undefined;
        Object.defineProperty(teamTargets, rawKey, {
          value: {
            cloudId,
            siteName,
            projectKey,
            projectName,
            digestIssueKey,
          },
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
    return {
      refreshToken: str('refreshToken'),
      accessExpiresAt: num('accessExpiresAt'),
      cloudId: str('cloudId'),
      siteName: str('siteName'),
      siteUrl: str('siteUrl'),
      projectKey: str('projectKey'),
      projectName: str('projectName'),
      issueKey: str('issueKey'),
      issueSummary: str('issueSummary'),
      digestIssueKey: str('digestIssueKey'),
      teamTargets:
        Object.keys(teamTargets).length > 0 ? teamTargets : undefined,
      oauthNonce: str('oauthNonce'),
      oauthExp: num('oauthExp'),
      oauthUserId: str('oauthUserId'),
    };
  }

  resolveProjectForTeam(
    meta: JiraMetadata,
    teamId?: string,
  ): {
    cloudId?: string;
    siteName?: string;
    projectKey?: string;
    projectName?: string;
    digestIssueKey?: string;
    isOverride: boolean;
  } {
    const override = readTeamTargetEntry(meta.teamTargets, teamId);
    if (override?.cloudId && override.projectKey) {
      return {
        cloudId: override.cloudId,
        siteName: override.siteName,
        projectKey: override.projectKey,
        projectName: override.projectName,
        digestIssueKey: override.digestIssueKey,
        isOverride: true,
      };
    }
    return {
      cloudId: meta.cloudId,
      siteName: meta.siteName,
      projectKey: meta.projectKey ?? projectFromIssueKey(meta.issueKey),
      projectName: meta.projectName,
      digestIssueKey: meta.digestIssueKey,
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
          provider: AddonProvider.JIRA,
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
  ): Promise<JiraConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const [connection, tool] = await Promise.all([
      this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.JIRA,
          },
        },
      }),
      this.prisma.workspaceTool.findUnique({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsJira,
          },
        },
      }),
    ]);

    const meta = this.asMetadata(connection?.metadataJson);
    return {
      status: (connection?.status ??
        AddonConnectionStatus.DISCONNECTED) as JiraConnectionDto['status'],
      configured: Boolean(connection?.secretsRef?.trim()),
      cloudId: meta.cloudId ?? null,
      siteName: meta.siteName ?? null,
      projectKey: meta.projectKey ?? null,
      issueKey: null,
      issueSummary: null,
      toolEnabled: tool?.enabled ?? false,
      oauthAvailable: this.oauthConfigured(),
    };
  }

  async startOAuth(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<JiraOAuthStartDto> {
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
    const pendingMeta: JiraMetadata = {
      oauthNonce: nonce,
      oauthExp: exp,
      oauthUserId: userId,
    };

    await this.prisma.addonConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.JIRA,
        },
      },
      create: {
        workspaceId,
        provider: AddonProvider.JIRA,
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
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: OAUTH_SCOPES,
      redirect_uri: this.redirectUri(),
      state,
      response_type: 'code',
      prompt: 'consent',
    });

    return {
      authorizeUrl: `${AUTHORIZE_URL}?${params.toString()}`,
    };
  }

  async completeOAuthCallback(
    code: unknown,
    state: unknown,
    errorFromAtlassian: unknown,
  ): Promise<string> {
    const errorText = this.asSingleString(errorFromAtlassian);
    if (errorText) {
      this.logger.warn(`Jira OAuth denied: ${errorText}`);
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

      const tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: codeText,
          redirect_uri: this.redirectUri(),
        }),
      });
      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      };

      if (!tokenRes.ok || !tokenJson.access_token) {
        this.logger.warn(
          `Jira token exchange failed: ${tokenJson.error ?? tokenRes.status} ${tokenJson.error_description ?? ''}`,
        );
        return this.workspaceRedirect(
          'error',
          tokenJson.error ?? 'token_exchange_failed',
        );
      }

      const expiresInSec =
        typeof tokenJson.expires_in === 'number' ? tokenJson.expires_in : 3600;
      const sites = await this.fetchAccessibleResources(tokenJson.access_token);
      const first = sites[0];
      const metadataJson: JiraMetadata = {
        refreshToken: tokenJson.refresh_token,
        accessExpiresAt: Date.now() + expiresInSec * 1000,
        cloudId: first?.id,
        siteName: first?.name,
        siteUrl: first?.url,
      };

      await this.prisma.$transaction([
        this.prisma.addonConnection.upsert({
          where: {
            workspaceId_provider: {
              workspaceId: payload.workspaceId,
              provider: AddonProvider.JIRA,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            provider: AddonProvider.JIRA,
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: tokenJson.access_token,
            externalId: first?.id ?? null,
            metadataJson,
          },
          update: {
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: tokenJson.access_token,
            externalId: first?.id ?? null,
            metadataJson,
          },
        }),
        this.prisma.workspaceTool.upsert({
          where: {
            workspaceId_toolKey: {
              workspaceId: payload.workspaceId,
              toolKey: TOOL_KEYS.addonsJira,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            toolKey: TOOL_KEYS.addonsJira,
            enabled: true,
          },
          update: { enabled: true },
        }),
      ]);

      return this.workspaceRedirect('connected');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Jira OAuth callback error: ${message}`);
      return this.workspaceRedirect('error', 'callback_failed');
    }
  }

  async listSites(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<JiraSiteDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);
    return this.fetchSites(workspaceId);
  }

  async listSitesForTeam(
    teamId: string,
    user: VerifiedUser,
  ): Promise<JiraSiteDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);
    return this.fetchSites(workspaceId);
  }

  private async fetchSites(workspaceId: string): Promise<JiraSiteDto[]> {
    const token = await this.requireFreshAccessToken(workspaceId);
    const sites = await this.fetchAccessibleResources(token);
    return sites.map((s) => ({
      cloudId: s.id,
      name: s.name,
      url: s.url,
    }));
  }

  async selectSite(
    workspaceId: string,
    user: VerifiedUser,
    body: SelectJiraSiteDto,
  ): Promise<JiraConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const cloudId = body.cloudId.trim();
    const token = await this.requireFreshAccessToken(workspaceId);
    const sites = await this.fetchAccessibleResources(token);
    const site = sites.find((s) => s.id === cloudId);
    if (!site) {
      throw new BadRequestException('Jira site not found for this connection');
    }

    const connection = await this.requireConnectedRow(workspaceId);
    const meta = this.asMetadata(connection.metadataJson);
    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: {
        externalId: site.id,
        metadataJson: storedMetadata({
          ...meta,
          cloudId: site.id,
          siteName: site.name,
          siteUrl: site.url,
          projectKey: undefined,
          projectName: undefined,
          issueKey: undefined,
          issueSummary: undefined,
          digestIssueKey: undefined,
        }),
      },
    });

    return this.getConnection(workspaceId, user);
  }

  async listProjects(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<JiraProjectDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);
    return this.fetchProjects(workspaceId);
  }

  async listProjectsForTeam(
    teamId: string,
    user: VerifiedUser,
    cloudId?: string,
  ): Promise<JiraProjectDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);
    return this.fetchProjects(workspaceId, cloudId);
  }

  private async fetchProjects(
    workspaceId: string,
    cloudIdOverride?: string,
  ): Promise<JiraProjectDto[]> {
    const { token, cloudId } = await this.requireCloudContext(
      workspaceId,
      cloudIdOverride,
    );
    const data = await this.jiraGet<{
      values?: Array<{ id: string; key: string; name: string }>;
    }>(token, cloudId, '/rest/api/3/project/search?maxResults=50');

    return (data.values ?? []).map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
    }));
  }

  async listIssues(
    workspaceId: string,
    user: VerifiedUser,
    projectKey: string,
  ): Promise<JiraIssueDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);
    return this.fetchIssues(workspaceId, projectKey);
  }

  async listIssuesForTeam(
    teamId: string,
    user: VerifiedUser,
    projectKey: string,
    cloudId?: string,
  ): Promise<JiraIssueDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);
    return this.fetchIssues(workspaceId, projectKey, cloudId);
  }

  private async fetchIssues(
    workspaceId: string,
    projectKey: string,
    cloudIdOverride?: string,
  ): Promise<JiraIssueDto[]> {
    const key = projectKey.trim();
    if (!key) {
      throw new BadRequestException('projectKey is required');
    }
    // Jira project keys are alphanumeric (+ underscore); reject anything else
    // rather than relying on partial JQL string escaping.
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      throw new BadRequestException('Invalid Jira project key');
    }

    const { token, cloudId } = await this.requireCloudContext(
      workspaceId,
      cloudIdOverride,
    );
    // Escape \ then " for JQL string literals (CodeQL incomplete-escaping).
    const escapedKey = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const issues = await this.searchJql(
      token,
      cloudId,
      `project = "${escapedKey}" ORDER BY updated DESC`,
      50,
    );

    return issues.flatMap((issue) =>
      issue.key
        ? [{ key: issue.key, summary: issue.fields?.summary ?? issue.key }]
        : [],
    );
  }

  async selectTarget(
    workspaceId: string,
    user: VerifiedUser,
    body: SelectJiraTargetDto,
  ): Promise<JiraConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const cloudId = body.cloudId.trim();
    const projectKey = body.projectKey.trim();
    const token = await this.requireFreshAccessToken(workspaceId);
    const project = await this.requireProject(token, cloudId, projectKey);

    const connection = await this.requireConnectedRow(workspaceId);
    const meta = this.asMetadata(connection.metadataJson);
    const sites = await this.fetchAccessibleResources(token);
    const site = sites.find((s) => s.id === cloudId);
    const sameProject =
      meta.cloudId === cloudId && meta.projectKey === project.key;

    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: {
        externalId: cloudId,
        metadataJson: storedMetadata({
          ...meta,
          cloudId,
          siteName: site?.name ?? meta.siteName,
          siteUrl: site?.url ?? meta.siteUrl,
          projectKey: project.key,
          projectName: project.name,
          issueKey: undefined,
          issueSummary: undefined,
          digestIssueKey: sameProject ? meta.digestIssueKey : undefined,
        }),
      },
    });

    return this.getConnection(workspaceId, user);
  }

  async getTeamTarget(
    teamId: string,
    user: VerifiedUser,
  ): Promise<TeamJiraTargetDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.JIRA,
        },
      },
    });
    const meta = this.asMetadata(connection?.metadataJson);
    const connected =
      connection?.status === AddonConnectionStatus.CONNECTED &&
      Boolean(connection.secretsRef?.trim());
    const resolved = this.resolveProjectForTeam(meta, teamId);
    return {
      cloudId: resolved.cloudId ?? null,
      siteName: resolved.siteName ?? null,
      projectKey: resolved.projectKey ?? null,
      issueKey: null,
      issueSummary: null,
      isOverride: resolved.isOverride,
      workspaceCloudId: meta.cloudId ?? null,
      workspaceSiteName: meta.siteName ?? null,
      workspaceProjectKey: meta.projectKey ?? null,
      workspaceIssueKey: null,
      workspaceIssueSummary: null,
      jiraConnected: connected,
    };
  }

  async setTeamTarget(
    teamId: string,
    user: VerifiedUser,
    body: SetTeamJiraTargetDto,
  ): Promise<TeamJiraTargetDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const cloudId = body.cloudId.trim();
    const projectKey = body.projectKey.trim();
    const token = await this.requireFreshAccessToken(workspaceId);
    const project = await this.requireProject(token, cloudId, projectKey);

    const connection = await this.requireConnectedRow(workspaceId);
    const meta = this.asMetadata(connection.metadataJson);
    const sites = await this.fetchAccessibleResources(token);
    const site = sites.find((s) => s.id === cloudId);
    const previous = readTeamTargetEntry(meta.teamTargets, teamId);
    const sameProject =
      previous?.cloudId === cloudId && previous.projectKey === project.key;
    const teamTargets = withTeamTargetEntry(meta.teamTargets, teamId, {
      cloudId,
      siteName: site?.name ?? meta.siteName,
      projectKey: project.key,
      projectName: project.name,
      digestIssueKey: sameProject ? previous?.digestIssueKey : undefined,
    });
    const nextMeta: JiraMetadata = { ...meta, teamTargets };

    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: { metadataJson: storedMetadata(nextMeta) },
    });

    return this.getTeamTarget(teamId, user);
  }

  async clearTeamTarget(
    teamId: string,
    user: VerifiedUser,
  ): Promise<TeamJiraTargetDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.JIRA,
        },
      },
    });
    if (!connection) {
      return {
        cloudId: null,
        siteName: null,
        projectKey: null,
        issueKey: null,
        issueSummary: null,
        isOverride: false,
        workspaceCloudId: null,
        workspaceSiteName: null,
        workspaceProjectKey: null,
        workspaceIssueKey: null,
        workspaceIssueSummary: null,
        jiraConnected: false,
      };
    }

    const meta = this.asMetadata(connection.metadataJson);
    if (readTeamTargetEntry(meta.teamTargets, teamId)) {
      const teamTargets = withTeamTargetEntry(meta.teamTargets, teamId, null);
      const nextMeta: JiraMetadata = { ...meta, teamTargets };
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
  ): Promise<JiraConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const existing = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.JIRA,
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
   * Posts standup summary as a Jira issue comment (ADF).
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
              toolKey: TOOL_KEYS.addonsJira,
            },
          },
        }),
        this.prisma.addonConnection.findUnique({
          where: {
            workspaceId_provider: {
              workspaceId: params.workspaceId,
              provider: AddonProvider.JIRA,
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
      const target = this.resolveProjectForTeam(meta, params.teamId);
      if (!target.cloudId || !target.projectKey) {
        this.logger.debug(
          `Jira digest skipped for workspace ${params.workspaceId}: no project selected`,
        );
        return false;
      }

      const token = await this.requireFreshAccessToken(params.workspaceId);
      const issueKey = await this.ensureDigestIssue(
        connection.id,
        meta,
        token,
        params.teamId,
        target.cloudId,
        target.projectKey,
        target.digestIssueKey,
      );
      const text = [
        `VibeStandup — ${params.teamName}`,
        params.entryDate,
        '',
        params.content,
      ].join('\n');

      const res = await fetch(
        `https://api.atlassian.com/ex/jira/${encodeURIComponent(target.cloudId)}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: mentionsToAdf(text) }),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(
          `Jira comment failed (${res.status}) for workspace ${params.workspaceId}: ${body.slice(0, 200)}`,
        );
        return false;
      }
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Jira digest post error for workspace ${params.workspaceId}: ${message}`,
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
      const tool = await this.prisma.workspaceTool.findUnique({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsJira,
          },
        },
      });
      if (!tool?.enabled) {
        return [];
      }
      const connection = await this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.JIRA,
          },
        },
      });
      if (
        connection?.status !== AddonConnectionStatus.CONNECTED ||
        !connection.secretsRef?.trim()
      ) {
        return [];
      }
      const meta = this.asMetadata(connection.metadataJson);
      const siteUrl = meta.siteUrl?.replace(/\/$/, '') ?? '';
      if (!meta.cloudId || !siteUrl.startsWith('https://')) {
        return [];
      }
      const token = await this.requireFreshAccessToken(workspaceId);
      const escaped = query
        .replace(/[\r\n]/g, ' ')
        .trim()
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      const found = await this.searchJql(
        token,
        meta.cloudId,
        `text ~ "${escaped}" AND updated >= -365d ORDER BY updated DESC`,
        8,
      );
      const issues: MentionIssue[] = [];
      for (const item of found) {
        if (!item.key || !/^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(item.key)) {
          continue;
        }
        const title = item.fields?.summary ?? item.key;
        issues.push({
          provider: 'jira',
          key: item.key,
          title: title.slice(0, 200),
          url: `${siteUrl}/browse/${encodeURIComponent(item.key)}`,
        });
      }
      return issues.slice(0, 8);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Jira issue search failed for workspace ${workspaceId}: ${message}`,
      );
      return [];
    }
  }

  private async requireConnectedRow(workspaceId: string) {
    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.JIRA,
        },
      },
    });
    if (
      !connection ||
      connection.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.trim()
    ) {
      throw new BadRequestException('Jira is not connected');
    }
    return connection;
  }

  private async requireCloudContext(
    workspaceId: string,
    cloudIdOverride?: string,
  ): Promise<{ token: string; cloudId: string }> {
    const token = await this.requireFreshAccessToken(workspaceId);
    const override = cloudIdOverride?.trim();
    if (override) {
      if (!/^[a-z0-9-]{8,64}$/i.test(override)) {
        throw new BadRequestException('Invalid Jira cloud id');
      }
      return { token, cloudId: override };
    }
    const connection = await this.requireConnectedRow(workspaceId);
    const meta = this.asMetadata(connection.metadataJson);
    if (!meta.cloudId) {
      throw new BadRequestException('Select a Jira site first');
    }
    return { token, cloudId: meta.cloudId };
  }

  private async requireFreshAccessToken(workspaceId: string): Promise<string> {
    const connection = await this.requireConnectedRow(workspaceId);
    const meta = this.asMetadata(connection.metadataJson);
    const skewMs = 60_000;
    if (
      meta.accessExpiresAt &&
      Date.now() < meta.accessExpiresAt - skewMs &&
      connection.secretsRef?.trim()
    ) {
      return connection.secretsRef.trim();
    }

    if (!meta.refreshToken) {
      return connection.secretsRef!.trim();
    }

    const { clientId, clientSecret } = this.requireOAuthConfigured();
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: meta.refreshToken,
      }),
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new ServiceUnavailableException(
        `Jira token refresh failed: ${tokenJson.error ?? tokenRes.status}`,
      );
    }

    const expiresInSec =
      typeof tokenJson.expires_in === 'number' ? tokenJson.expires_in : 3600;
    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: {
        secretsRef: tokenJson.access_token,
        metadataJson: storedMetadata({
          ...meta,
          refreshToken: tokenJson.refresh_token ?? meta.refreshToken,
          accessExpiresAt: Date.now() + expiresInSec * 1000,
        }),
      },
    });
    return tokenJson.access_token;
  }

  private async fetchAccessibleResources(accessToken: string): Promise<
    Array<{
      id: string;
      name: string;
      url: string;
    }>
  > {
    const res = await fetch(RESOURCES_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Jira accessible-resources failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as Array<{
      id: string;
      name: string;
      url: string;
    }>;
    return json ?? [];
  }

  private async requireProject(
    token: string,
    cloudId: string,
    projectKey: string,
  ): Promise<{ key: string; name?: string }> {
    const key = projectKey.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      throw new BadRequestException('Invalid Jira project key');
    }
    const project = await this.jiraSend<{ key?: string; name?: string }>(
      token,
      cloudId,
      `/rest/api/3/project/${encodeURIComponent(key)}`,
    );
    if (!project.body?.key) {
      throw new BadRequestException('Jira project not found');
    }
    return { key: project.body.key, name: project.body.name };
  }

  private async ensureDigestIssue(
    connectionId: string,
    meta: JiraMetadata,
    token: string,
    teamId: string | undefined,
    cloudId: string,
    projectKey: string,
    existing: string | undefined,
  ): Promise<string> {
    if (existing && /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(existing)) {
      const current = await this.jiraSend<{
        key?: string;
        fields?: { summary?: string };
      }>(
        token,
        cloudId,
        `/rest/api/3/issue/${encodeURIComponent(existing)}?fields=summary`,
      );
      if (
        current.body?.key &&
        current.body.fields?.summary === DIGEST_ISSUE_SUMMARY
      ) {
        return current.body.key;
      }
    }

    const escapedKey = projectKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedTitle = DIGEST_ISSUE_SUMMARY.replace(/\\/g, '\\\\').replace(
      /"/g,
      '\\"',
    );
    const found = (
      await this.searchJql(
        token,
        cloudId,
        `project = "${escapedKey}" AND summary ~ "\\"${escapedTitle}\\"" ORDER BY created ASC`,
        5,
      )
    ).find((issue) => issue.fields?.summary === DIGEST_ISSUE_SUMMARY);
    const key =
      found?.key ?? (await this.createDigestIssue(token, cloudId, projectKey));
    await this.saveDigestIssueKey(
      connectionId,
      meta,
      teamId,
      cloudId,
      projectKey,
      key,
    );
    return key;
  }

  private async createDigestIssue(
    token: string,
    cloudId: string,
    projectKey: string,
  ): Promise<string> {
    const project = await this.jiraGet<{
      issueTypes?: Array<{ id?: string; name?: string; subtask?: boolean }>;
    }>(token, cloudId, `/rest/api/3/project/${encodeURIComponent(projectKey)}`);
    const types = project.issueTypes ?? [];
    const issueType =
      types.find((type) => !type.subtask && type.name === 'Task') ??
      types.find((type) => !type.subtask && type.id) ??
      types.find((type) => type.id);
    if (!issueType?.id) {
      throw new BadGatewayException('jira.request');
    }
    const created = await this.jiraSend<{ key?: string }>(
      token,
      cloudId,
      '/rest/api/3/issue',
      {
        method: 'POST',
        body: {
          fields: {
            project: { key: projectKey },
            summary: DIGEST_ISSUE_SUMMARY,
            issuetype: { id: issueType.id },
            description: mentionsToAdf(
              'Daily VibeStandup summaries are posted on this issue as comments.',
            ),
          },
        },
      },
    );
    if (!created.body?.key) {
      throw new BadGatewayException('jira.request');
    }
    return created.body.key;
  }

  private async saveDigestIssueKey(
    connectionId: string,
    meta: JiraMetadata,
    teamId: string | undefined,
    cloudId: string,
    projectKey: string,
    issueKey: string,
  ): Promise<void> {
    const override = teamId
      ? readTeamTargetEntry(meta.teamTargets, teamId)
      : undefined;
    const next: JiraMetadata =
      override?.cloudId === cloudId &&
      override.projectKey === projectKey &&
      teamId
        ? {
            ...meta,
            teamTargets: withTeamTargetEntry(meta.teamTargets, teamId, {
              ...override,
              digestIssueKey: issueKey,
            }),
          }
        : { ...meta, digestIssueKey: issueKey };
    await this.prisma.addonConnection.update({
      where: { id: connectionId },
      data: { metadataJson: storedMetadata(next) },
    });
  }

  private async searchJql(
    token: string,
    cloudId: string,
    jql: string,
    maxResults: number,
  ): Promise<Array<{ key?: string; fields?: { summary?: string } }>> {
    const result = await this.jiraSend<{
      issues?: Array<{ key?: string; fields?: { summary?: string } }>;
    }>(token, cloudId, '/rest/api/3/search/jql', {
      method: 'POST',
      body: { jql, maxResults, fields: ['summary'] },
    });
    return result.body?.issues ?? [];
  }

  private async jiraGet<T>(
    accessToken: string,
    cloudId: string,
    path: string,
  ): Promise<T> {
    const result = await this.jiraSend<T>(accessToken, cloudId, path);
    if (!result.body) {
      throw new BadGatewayException('jira.request');
    }
    return result.body;
  }

  private async jiraSend<T>(
    accessToken: string,
    cloudId: string,
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<{ body: T | null }> {
    const res = await fetch(
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}${path}`,
      {
        method: init?.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
      },
    );
    if (res.status === 404) {
      return { body: null };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(
        `Jira API ${path} failed (${res.status}): ${text.slice(0, 200)}`,
      );
      if (res.status === 401 || res.status === 403) {
        throw new UnauthorizedException('jira.token');
      }
      throw new BadGatewayException('jira.request');
    }
    return { body: (await res.json()) as T };
  }
}
