import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { enabledToolKeys } from '@silvervibe/shared/data-access';
import { isKnownToolKey } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for workspaces and entitlements',
      );
    }
  }

  private async resolveUserId(user: VerifiedUser): Promise<string> {
    const record = await this.users.upsertFromFirebase(user);
    return record.id;
  }

  private async requireWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<{ role: WorkspaceRole }> {
    this.ensureDb();
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    return membership;
  }

  private async requireWorkspaceAdmin(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.requireWorkspaceMember(workspaceId, userId);
    if (
      membership.role !== WorkspaceRole.OWNER &&
      membership.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException('Workspace admin required');
    }
  }

  async create(name: string, slug: string, ownerUserId?: string) {
    this.ensureDb();
    return this.prisma.workspace.create({
      data: {
        name,
        slug,
        ...(ownerUserId
          ? {
              members: {
                create: { userId: ownerUserId, role: 'OWNER' },
              },
              tools: {
                create: { toolKey: 'vibestandup', enabled: true },
              },
            }
          : {}),
      },
    });
  }

  async getOrThrow(workspaceId: string) {
    this.ensureDb();
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }
    return workspace;
  }

  private async fetchTools(workspaceId: string) {
    await this.getOrThrow(workspaceId);
    return this.prisma.workspaceTool.findMany({
      where: { workspaceId },
      orderBy: { toolKey: 'asc' },
      select: { toolKey: true, enabled: true },
    });
  }

  async listTools(workspaceId: string, user: VerifiedUser) {
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceMember(workspaceId, userId);
    return this.fetchTools(workspaceId);
  }

  async listEnabledToolKeys(workspaceId: string): Promise<string[]> {
    const rows = await this.fetchTools(workspaceId);
    return enabledToolKeys(rows);
  }

  async setToolEntitlement(
    workspaceId: string,
    toolKey: string,
    enabled: boolean,
    user: VerifiedUser,
  ) {
    if (!isKnownToolKey(toolKey)) {
      throw new BadRequestException(
        `Unknown toolKey "${toolKey}". Use TOOL_KEYS from @silvervibe/shared/feature-flags`,
      );
    }
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceAdmin(workspaceId, userId);
    await this.getOrThrow(workspaceId);

    return this.prisma.workspaceTool.upsert({
      where: {
        workspaceId_toolKey: { workspaceId, toolKey },
      },
      create: { workspaceId, toolKey, enabled },
      update: { enabled },
      select: { toolKey: true, enabled: true },
    });
  }
}
