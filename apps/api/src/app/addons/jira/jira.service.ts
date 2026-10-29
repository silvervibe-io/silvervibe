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
import { readTeamTargetEntry } from '../team-target-meta';
import {
  JiraConnectionDto,
  JiraIssueDto,
  JiraOAuthStartDto,
  JiraProjectDto,
  JiraSiteDto,
  SelectJiraSiteDto,
  SelectJiraTargetDto,
} from './jira.dto';

type JiraTeamTarget = {
  cloudId: string;
  siteName?: string;
  projectKey?: string;
  issueKey: string;
  issueSummary?: string;
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
  /** Per-team issue overrides; workspace target remains the default. */
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
        const issueKey =
          typeof entry['issueKey'] === 'string' && entry['issueKey'].trim()
            ? entry['issueKey'].trim()
            : undefined;
        if (!cloudId || !issueKey) {
          continue;
        }
        const siteName =
          typeof entry['siteName'] === 'string' && entry['siteName'].trim()
            ? entry['siteName'].trim()
            : undefined;
        const projectKey =
          typeof entry['projectKey'] === 'string' && entry['projectKey'].trim()
            ? entry['projectKey'].trim()
            : undefined;
        const issueSummary =
          typeof entry['issueSummary'] === 'string' &&
          entry['issueSummary'].trim()
            ? entry['issueSummary'].trim()
            : undefined;
        Object.defineProperty(teamTargets, rawKey, {
          value: { cloudId, siteName, projectKey, issueKey, issueSummary },
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
      teamTargets:
        Object.keys(teamTargets).length > 0 ? teamTargets : undefined,
      oauthNonce: str('oauthNonce'),
      oauthExp: num('oauthExp'),
      oauthUserId: str('oauthUserId'),
    };
  }

  resolveIssueForTeam(
    meta: JiraMetadata,
    teamId?: string,
  ): {
    cloudId?: string;
    siteName?: string;
    projectKey?: string;
    issueKey?: string;
    issueSummary?: string;
    isOverride: boolean;
  } {
    const override = readTeamTargetEntry(meta.teamTargets, teamId);
    if (override?.cloudId && override.issueKey) {
      return {
        cloudId: override.cloudId,
        siteName: override.siteName,
        projectKey: override.projectKey,
        issueKey: override.issueKey,
        issueSummary: override.issueSummary,
        isOverride: true,
      };
    }
    return {
      cloudId: meta.cloudId,
      siteName: meta.siteName,
      projectKey: meta.projectKey,
      issueKey: meta.issueKey,
      issueSummary: meta.issueSummary,
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
      issueKey: meta.issueKey ?? null,
      issueSummary: meta.issueSummary ?? null,
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
        metadataJson: {
          ...meta,
          cloudId: site.id,
          siteName: site.name,
          siteUrl: site.url,
          projectKey: undefined,
          projectName: undefined,
          issueKey: undefined,
          issueSummary: undefined,
        },
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

    const { token, cloudId } = await this.requireCloudContext(workspaceId);
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

    const key = projectKey.trim();
    if (!key) {
      throw new BadRequestException('projectKey is required');
    }
    // Jira project keys are alphanumeric (+ underscore); reject anything else
    // rather than relying on partial JQL string escaping.
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      throw new BadRequestException('Invalid Jira project key');
    }

    const { token, cloudId } = await this.requireCloudContext(workspaceId);
    // Escape \ then " for JQL string literals (CodeQL incomplete-escaping).
    const escapedKey = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const jql = encodeURIComponent(
      `project = "${escapedKey}" ORDER BY updated DESC`,
    );
    const data = await this.jiraGet<{
      issues?: Array<{
        key: string;
        fields?: { summary?: string };
      }>;
    }>(
      token,
      cloudId,
      `/rest/api/3/search?jql=${jql}&maxResults=50&fields=summary`,
    );

    return (data.issues ?? []).map((i) => ({
      key: i.key,
      summary: i.fields?.summary ?? i.key,
    }));
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
    const issueKey = body.issueKey.trim();
    const token = await this.requireFreshAccessToken(workspaceId);

    const issue = await this.jiraGet<{
      key: string;
      fields?: { summary?: string; project?: { key?: string; name?: string } };
    }>(
      token,
      cloudId,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,project`,
    );
    if (!issue?.key) {
      throw new BadRequestException('Jira issue not found');
    }

    const connection = await this.requireConnectedRow(workspaceId);
    const meta = this.asMetadata(connection.metadataJson);
    const sites = await this.fetchAccessibleResources(token);
    const site = sites.find((s) => s.id === cloudId);

    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: {
        externalId: cloudId,
        metadataJson: {
          ...meta,
          cloudId,
          siteName: site?.name ?? meta.siteName,
          siteUrl: site?.url ?? meta.siteUrl,
          projectKey: issue.fields?.project?.key ?? projectKey,
          projectName: issue.fields?.project?.name,
          issueKey: issue.key,
          issueSummary: issue.fields?.summary,
        },
      },
    });

    return this.getConnection(workspaceId, user);
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
      const target = this.resolveIssueForTeam(meta, params.teamId);
      if (!target.cloudId || !target.issueKey) {
        this.logger.debug(
          `Jira digest skipped for workspace ${params.workspaceId}: no issue target`,
        );
        return false;
      }

      const token = await this.requireFreshAccessToken(params.workspaceId);
      const text = [
        `VibeStandup — ${params.teamName}`,
        params.entryDate,
        '',
        params.content,
      ].join('\n');

      const res = await fetch(
        `https://api.atlassian.com/ex/jira/${encodeURIComponent(target.cloudId)}/rest/api/3/issue/${encodeURIComponent(target.issueKey)}/comment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: this.toAdf(text) }),
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

  private toAdf(text: string): {
    type: 'doc';
    version: 1;
    content: Array<{
      type: 'paragraph';
      content: Array<{ type: 'text'; text: string }>;
    }>;
  } {
    const lines = text.split('\n');
    return {
      type: 'doc',
      version: 1,
      content: lines.map((line) => ({
        type: 'paragraph' as const,
        content: line
          ? [{ type: 'text' as const, text: line }]
          : [{ type: 'text' as const, text: ' ' }],
      })),
    };
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
  ): Promise<{ token: string; cloudId: string }> {
    const token = await this.requireFreshAccessToken(workspaceId);
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
        metadataJson: {
          ...meta,
          refreshToken: tokenJson.refresh_token ?? meta.refreshToken,
          accessExpiresAt: Date.now() + expiresInSec * 1000,
        },
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

  private async jiraGet<T>(
    accessToken: string,
    cloudId: string,
    path: string,
  ): Promise<T> {
    const res = await fetch(
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}${path}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Jira API ${path} failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    return (await res.json()) as T;
  }
}
