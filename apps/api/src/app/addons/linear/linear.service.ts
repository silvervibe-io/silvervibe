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
  LinearConnectionDto,
  LinearOAuthStartDto,
  LinearProjectDto,
  SelectLinearProjectDto,
  SetTeamLinearProjectDto,
  TeamLinearProjectDto,
} from './linear.dto';

type LinearTeamTarget = {
  projectId: string;
  projectName?: string;
};

type LinearMetadata = {
  refreshToken?: string;
  /** Epoch ms when access token expires */
  accessExpiresAt?: number;
  projectId?: string;
  projectName?: string;
  organizationName?: string;
  /** Per-team project overrides; workspace projectId remains the default. */
  teamTargets?: Record<string, LinearTeamTarget>;
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

const OAUTH_SCOPES = 'read,write';
const STATE_TTL_MS = 15 * 60 * 1000;
const GRAPHQL_URL = 'https://api.linear.app/graphql';
const TOKEN_URL = 'https://api.linear.app/oauth/token';

@Injectable()
export class LinearService {
  private readonly logger = new Logger(LinearService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  status(): AddonStatusDto {
    return { name: 'linear', status: 'ready' };
  }

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for Linear connections',
      );
    }
  }

  private linearClientId(): string | undefined {
    return process.env['LINEAR_CLIENT_ID']?.trim() || undefined;
  }

  private linearClientSecret(): string | undefined {
    return process.env['LINEAR_CLIENT_SECRET']?.trim() || undefined;
  }

  oauthConfigured(): boolean {
    return Boolean(this.linearClientId() && this.linearClientSecret());
  }

  private requireOAuthConfigured(): { clientId: string; clientSecret: string } {
    const clientId = this.linearClientId();
    const clientSecret = this.linearClientSecret();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Linear OAuth is not configured (LINEAR_CLIENT_ID / LINEAR_CLIENT_SECRET)',
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
    const override = process.env['LINEAR_REDIRECT_URI']?.trim();
    if (override) {
      return override;
    }
    return `${this.publicApiBase()}/addons/linear/oauth/callback`;
  }

  private standupAppOrigin(): string {
    return (
      process.env['PUBLIC_STANDUP_URL']?.trim().replace(/\/$/, '') ||
      'http://localhost:4201'
    );
  }

  workspaceRedirect(result: 'connected' | 'error', detail?: unknown): string {
    const url = new URL('/app/workspace', `${this.standupAppOrigin()}/`);
    url.searchParams.set('linear', result);
    const detailText = this.asSingleString(detail);
    if (detailText) {
      url.searchParams.set('linearDetail', detailText.slice(0, 120));
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

  private asMetadata(raw: unknown): LinearMetadata {
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
    const teamTargets: Record<string, LinearTeamTarget> = {};
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
        const projectId =
          typeof entry['projectId'] === 'string' && entry['projectId'].trim()
            ? entry['projectId'].trim()
            : undefined;
        if (!projectId) {
          continue;
        }
        const projectName =
          typeof entry['projectName'] === 'string' &&
          entry['projectName'].trim()
            ? entry['projectName'].trim()
            : undefined;
        Object.defineProperty(teamTargets, rawKey, {
          value: { projectId, projectName },
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
    return {
      refreshToken: str('refreshToken'),
      accessExpiresAt: num('accessExpiresAt'),
      projectId: str('projectId'),
      projectName: str('projectName'),
      organizationName: str('organizationName'),
      teamTargets:
        Object.keys(teamTargets).length > 0 ? teamTargets : undefined,
      oauthNonce: str('oauthNonce'),
      oauthExp: num('oauthExp'),
      oauthUserId: str('oauthUserId'),
    };
  }

  resolveProjectForTeam(
    meta: LinearMetadata,
    teamId?: string,
  ): { projectId?: string; projectName?: string; isOverride: boolean } {
    const override = readTeamTargetEntry(meta.teamTargets, teamId);
    if (override?.projectId) {
      return {
        projectId: override.projectId,
        projectName: override.projectName,
        isOverride: true,
      };
    }
    return {
      projectId: meta.projectId,
      projectName: meta.projectName,
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
          provider: AddonProvider.LINEAR,
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
  ): Promise<LinearConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const [connection, tool] = await Promise.all([
      this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.LINEAR,
          },
        },
      }),
      this.prisma.workspaceTool.findUnique({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsLinear,
          },
        },
      }),
    ]);

    const meta = this.asMetadata(connection?.metadataJson);
    return {
      status: (connection?.status ??
        AddonConnectionStatus.DISCONNECTED) as LinearConnectionDto['status'],
      configured: Boolean(connection?.secretsRef?.trim()),
      projectId: meta.projectId ?? null,
      projectName: meta.projectName ?? null,
      organizationName: meta.organizationName ?? null,
      toolEnabled: tool?.enabled ?? false,
      oauthAvailable: this.oauthConfigured(),
    };
  }

  async startOAuth(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<LinearOAuthStartDto> {
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
    const pendingMeta: LinearMetadata = {
      oauthNonce: nonce,
      oauthExp: exp,
      oauthUserId: userId,
    };

    await this.prisma.addonConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.LINEAR,
        },
      },
      create: {
        workspaceId,
        provider: AddonProvider.LINEAR,
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
      response_type: 'code',
      scope: OAUTH_SCOPES,
      state,
      prompt: 'consent',
      actor: 'app',
    });

    return {
      authorizeUrl: `https://linear.app/oauth/authorize?${params.toString()}`,
    };
  }

  async completeOAuthCallback(
    code: unknown,
    state: unknown,
    errorFromLinear: unknown,
  ): Promise<string> {
    const errorText = this.asSingleString(errorFromLinear);
    if (errorText) {
      this.logger.warn(`Linear OAuth denied: ${errorText}`);
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
        code: codeText,
        redirect_uri: this.redirectUri(),
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
      });

      const tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
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
          `Linear token exchange failed: ${tokenJson.error ?? tokenRes.status} ${tokenJson.error_description ?? ''}`,
        );
        return this.workspaceRedirect(
          'error',
          tokenJson.error ?? 'token_exchange_failed',
        );
      }

      const expiresInSec =
        typeof tokenJson.expires_in === 'number' ? tokenJson.expires_in : 86400;
      const orgName = await this.fetchOrganizationName(tokenJson.access_token);

      const metadataJson: LinearMetadata = {
        refreshToken: tokenJson.refresh_token,
        accessExpiresAt: Date.now() + expiresInSec * 1000,
        organizationName: orgName,
      };

      await this.prisma.$transaction([
        this.prisma.addonConnection.upsert({
          where: {
            workspaceId_provider: {
              workspaceId: payload.workspaceId,
              provider: AddonProvider.LINEAR,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            provider: AddonProvider.LINEAR,
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: tokenJson.access_token,
            metadataJson,
          },
          update: {
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: tokenJson.access_token,
            metadataJson,
          },
        }),
        this.prisma.workspaceTool.upsert({
          where: {
            workspaceId_toolKey: {
              workspaceId: payload.workspaceId,
              toolKey: TOOL_KEYS.addonsLinear,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            toolKey: TOOL_KEYS.addonsLinear,
            enabled: true,
          },
          update: { enabled: true },
        }),
      ]);

      return this.workspaceRedirect('connected');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Linear OAuth callback error: ${message}`);
      return this.workspaceRedirect('error', 'callback_failed');
    }
  }

  async listProjects(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<LinearProjectDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);
    return this.fetchProjects(workspaceId);
  }

  async listProjectsForTeam(
    teamId: string,
    user: VerifiedUser,
  ): Promise<LinearProjectDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);
    return this.fetchProjects(workspaceId);
  }

  private async fetchProjects(
    workspaceId: string,
  ): Promise<LinearProjectDto[]> {
    const accessToken = await this.requireFreshAccessToken(workspaceId);
    const data = await this.graphql<{
      projects: { nodes: Array<{ id: string; name: string }> };
    }>(accessToken, {
      query: `query { projects(first: 50) { nodes { id name } } }`,
    });
    return (data.projects?.nodes ?? []).map((p) => ({
      id: p.id,
      name: p.name,
    }));
  }

  async selectProject(
    workspaceId: string,
    user: VerifiedUser,
    body: SelectLinearProjectDto,
  ): Promise<LinearConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const projectId = body.projectId.trim();
    const accessToken = await this.requireFreshAccessToken(workspaceId);
    const data = await this.graphql<{
      project: { id: string; name: string } | null;
    }>(accessToken, {
      query: `query($id: String!) { project(id: $id) { id name } }`,
      variables: { id: projectId },
    });
    if (!data.project?.id) {
      throw new BadRequestException('Linear project not found');
    }

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.LINEAR,
        },
      },
    });
    if (
      !connection ||
      connection.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.trim()
    ) {
      throw new BadRequestException('Linear is not connected');
    }

    const meta = this.asMetadata(connection.metadataJson);
    const metadataJson: LinearMetadata = {
      ...meta,
      projectId: data.project.id,
      projectName: data.project.name,
    };
    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: { metadataJson },
    });

    return this.getConnection(workspaceId, user);
  }

  async getTeamProject(
    teamId: string,
    user: VerifiedUser,
  ): Promise<TeamLinearProjectDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.LINEAR,
        },
      },
    });
    const meta = this.asMetadata(connection?.metadataJson);
    const connected =
      connection?.status === AddonConnectionStatus.CONNECTED &&
      Boolean(connection.secretsRef?.trim());
    const resolved = this.resolveProjectForTeam(meta, teamId);
    return {
      projectId: resolved.projectId ?? null,
      projectName: resolved.projectName ?? null,
      isOverride: resolved.isOverride,
      workspaceProjectId: meta.projectId ?? null,
      workspaceProjectName: meta.projectName ?? null,
      linearConnected: connected,
    };
  }

  async setTeamProject(
    teamId: string,
    user: VerifiedUser,
    body: SetTeamLinearProjectDto,
  ): Promise<TeamLinearProjectDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const projectId = body.projectId.trim();
    const accessToken = await this.requireFreshAccessToken(workspaceId);
    const data = await this.graphql<{
      project: { id: string; name: string } | null;
    }>(accessToken, {
      query: `query($id: String!) { project(id: $id) { id name } }`,
      variables: { id: projectId },
    });
    if (!data.project?.id) {
      throw new BadRequestException('Linear project not found');
    }

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.LINEAR,
        },
      },
    });
    if (
      !connection ||
      connection.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.trim()
    ) {
      throw new BadRequestException(
        'Linear is not connected for this workspace',
      );
    }

    const meta = this.asMetadata(connection.metadataJson);
    const teamTargets = withTeamTargetEntry(meta.teamTargets, teamId, {
      projectId: data.project.id,
      projectName: data.project.name,
    });
    const nextMeta: LinearMetadata = { ...meta, teamTargets };

    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: { metadataJson: nextMeta },
    });

    return this.getTeamProject(teamId, user);
  }

  async clearTeamProject(
    teamId: string,
    user: VerifiedUser,
  ): Promise<TeamLinearProjectDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.requireTeamAdmin(teamId, userId);

    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.LINEAR,
        },
      },
    });
    if (!connection) {
      return {
        projectId: null,
        projectName: null,
        isOverride: false,
        workspaceProjectId: null,
        workspaceProjectName: null,
        linearConnected: false,
      };
    }

    const meta = this.asMetadata(connection.metadataJson);
    if (readTeamTargetEntry(meta.teamTargets, teamId)) {
      const teamTargets = withTeamTargetEntry(meta.teamTargets, teamId, null);
      const nextMeta: LinearMetadata = { ...meta, teamTargets };
      await this.prisma.addonConnection.update({
        where: { id: connection.id },
        data: { metadataJson: nextMeta },
      });
    }

    return this.getTeamProject(teamId, user);
  }

  async disconnect(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<LinearConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);

    const existing = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.LINEAR,
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
   * Posts standup summary as a Linear project update.
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
              toolKey: TOOL_KEYS.addonsLinear,
            },
          },
        }),
        this.prisma.addonConnection.findUnique({
          where: {
            workspaceId_provider: {
              workspaceId: params.workspaceId,
              provider: AddonProvider.LINEAR,
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
      if (!target.projectId) {
        this.logger.debug(
          `Linear digest skipped for workspace ${params.workspaceId}: no project selected`,
        );
        return false;
      }

      const accessToken = await this.requireFreshAccessToken(
        params.workspaceId,
      );
      const projectLabel = target.projectName ? ` (${target.projectName})` : '';
      const body = [
        `## VibeStandup — ${params.teamName}${projectLabel}`,
        `_${params.entryDate}_`,
        '',
        params.content,
      ].join('\n');

      const result = await this.graphql<{
        projectUpdateCreate: { success?: boolean };
      }>(accessToken, {
        query: `mutation($input: ProjectUpdateCreateInput!) {
          projectUpdateCreate(input: $input) { success }
        }`,
        variables: {
          input: {
            projectId: target.projectId,
            body,
            health: 'onTrack',
          },
        },
      });

      if (!result.projectUpdateCreate?.success) {
        this.logger.warn(
          `Linear projectUpdateCreate failed for workspace ${params.workspaceId}`,
        );
        return false;
      }
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Linear digest post error for workspace ${params.workspaceId}: ${message}`,
      );
      return false;
    }
  }

  private async requireFreshAccessToken(workspaceId: string): Promise<string> {
    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.LINEAR,
        },
      },
    });
    if (
      !connection ||
      connection.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.trim()
    ) {
      throw new BadRequestException('Linear is not connected');
    }

    const meta = this.asMetadata(connection.metadataJson);
    const skewMs = 60_000;
    if (
      meta.accessExpiresAt &&
      Date.now() < meta.accessExpiresAt - skewMs &&
      connection.secretsRef.trim()
    ) {
      return connection.secretsRef.trim();
    }

    if (!meta.refreshToken) {
      return connection.secretsRef.trim();
    }

    const { clientId, clientSecret } = this.requireOAuthConfigured();
    const body = new URLSearchParams({
      refresh_token: meta.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new ServiceUnavailableException(
        `Linear token refresh failed: ${tokenJson.error ?? tokenRes.status}`,
      );
    }

    const expiresInSec =
      typeof tokenJson.expires_in === 'number' ? tokenJson.expires_in : 86400;
    const metadataJson: LinearMetadata = {
      ...meta,
      refreshToken: tokenJson.refresh_token ?? meta.refreshToken,
      accessExpiresAt: Date.now() + expiresInSec * 1000,
    };
    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: {
        secretsRef: tokenJson.access_token,
        metadataJson,
      },
    });
    return tokenJson.access_token;
  }

  private async fetchOrganizationName(
    accessToken: string,
  ): Promise<string | undefined> {
    try {
      const data = await this.graphql<{
        organization: { name?: string } | null;
      }>(accessToken, {
        query: `query { organization { name } }`,
      });
      return data.organization?.name?.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private async graphql<T>(
    accessToken: string,
    body: { query: string; variables?: Record<string, unknown> },
  ): Promise<T> {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };
    if (!res.ok || json.errors?.length) {
      const msg =
        json.errors
          ?.map((e) => e.message)
          .filter(Boolean)
          .join('; ') || String(res.status);
      throw new Error(`Linear GraphQL error: ${msg}`);
    }
    if (!json.data) {
      throw new Error('Linear GraphQL returned no data');
    }
    return json.data;
  }
}
