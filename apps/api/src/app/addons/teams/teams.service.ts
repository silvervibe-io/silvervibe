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
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { AddonStatusDto } from '../addon-status.dto';
import { ConnectTeamsDto, TeamsConnectionDto } from './teams.dto';

type TeamsMetadata = {
  channelLabel?: string;
};

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
    const label = (raw as TeamsMetadata).channelLabel;
    return {
      channelLabel: typeof label === 'string' ? label : undefined,
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
    const configured = Boolean(connection?.secretsRef?.trim());
    return {
      status: (connection?.status ??
        AddonConnectionStatus.DISCONNECTED) as TeamsConnectionDto['status'],
      configured,
      channelLabel: meta.channelLabel ?? null,
      toolEnabled: tool?.enabled ?? false,
    };
  }

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
    const metadataJson: TeamsMetadata = channelLabel ? { channelLabel } : {};

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
          metadataJson: {},
        },
      });
    }

    return this.getConnection(workspaceId, user);
  }

  /**
   * Posts standup summary text to the workspace Teams Incoming Webhook.
   * Soft-fail: logs and returns false on any error (never throws to callers).
   *
   * Deferred (#108): product UI is hidden until we have Microsoft 365/Teams.
   * Keep Nest endpoints for a later resume; digests are no-ops for now.
   */
  async postStandupDigest(params: {
    workspaceId: string;
    teamName: string;
    entryDate: string;
    content: string;
  }): Promise<boolean> {
    void params;
    // Resume posting from feature/106-teams-oauth-connect when M365/Teams is available.
    this.logger.debug(
      'Teams standup digest deferred (#108); skipping postStandupDigest',
    );
    return false;
  }
}
