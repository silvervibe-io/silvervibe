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
import { ConnectSlackDto, SlackConnectionDto } from './slack.dto';

type SlackMetadata = {
  channelLabel?: string;
};

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
    const label = (raw as SlackMetadata).channelLabel;
    return {
      channelLabel: typeof label === 'string' ? label : undefined,
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
      channelLabel: meta.channelLabel ?? null,
      toolEnabled: tool?.enabled ?? false,
    };
  }

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
    const metadataJson: SlackMetadata = channelLabel ? { channelLabel } : {};

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
          metadataJson: {},
        },
      });
    }

    return this.getConnection(workspaceId, user);
  }

  /**
   * Posts standup summary markdown to the workspace Slack Incoming Webhook.
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

      const webhookUrl = connection.secretsRef.trim();
      const meta = this.asMetadata(connection.metadataJson);
      const channel = meta.channelLabel ? ` (${meta.channelLabel})` : '';
      const text = [
        `*VibeStandup — ${params.teamName}${channel}*`,
        `_${params.entryDate}_`,
        '',
        params.content,
      ].join('\n');

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(
          `Slack digest post failed (${res.status}) for workspace ${params.workspaceId}: ${body.slice(0, 200)}`,
        );
        return false;
      }
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Slack digest post error for workspace ${params.workspaceId}: ${message}`,
      );
      return false;
    }
  }
}
