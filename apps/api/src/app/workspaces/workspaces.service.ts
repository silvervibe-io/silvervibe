import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { enabledToolKeys } from '@silvervibe/shared/data-access';
import { isKnownToolKey } from '@silvervibe/shared/feature-flags';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for workspaces and entitlements',
      );
    }
  }

  async create(name: string, slug: string) {
    this.ensureDb();
    return this.prisma.workspace.create({
      data: { name, slug },
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

  async listTools(workspaceId: string) {
    await this.getOrThrow(workspaceId);
    return this.prisma.workspaceTool.findMany({
      where: { workspaceId },
      orderBy: { toolKey: 'asc' },
      select: { toolKey: true, enabled: true },
    });
  }

  async listEnabledToolKeys(workspaceId: string): Promise<string[]> {
    const rows = await this.listTools(workspaceId);
    return enabledToolKeys(rows);
  }

  async setToolEntitlement(
    workspaceId: string,
    toolKey: string,
    enabled: boolean,
  ) {
    if (!isKnownToolKey(toolKey)) {
      throw new BadRequestException(
        `Unknown toolKey "${toolKey}". Use TOOL_KEYS from @silvervibe/shared/feature-flags`,
      );
    }
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
