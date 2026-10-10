import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  it('rejects unknown tool keys', async () => {
    const prisma = {
      isEnabled: () => true,
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ws1' }),
      },
    } as unknown as PrismaService;
    const service = new WorkspacesService(prisma);
    await expect(
      service.setToolEntitlement('ws1', 'not-a-tool', true),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('grants a known tool via upsert', async () => {
    const upsert = jest.fn().mockResolvedValue({
      toolKey: TOOL_KEYS.vibestandup,
      enabled: true,
    });
    const prisma = {
      isEnabled: () => true,
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ws1' }),
      },
      workspaceTool: { upsert },
    } as unknown as PrismaService;
    const service = new WorkspacesService(prisma);
    const result = await service.setToolEntitlement(
      'ws1',
      TOOL_KEYS.vibestandup,
      true,
    );
    expect(upsert).toHaveBeenCalledWith({
      where: {
        workspaceId_toolKey: {
          workspaceId: 'ws1',
          toolKey: TOOL_KEYS.vibestandup,
        },
      },
      create: {
        workspaceId: 'ws1',
        toolKey: TOOL_KEYS.vibestandup,
        enabled: true,
      },
      update: { enabled: true },
      select: { toolKey: true, enabled: true },
    });
    expect(result).toEqual({
      toolKey: TOOL_KEYS.vibestandup,
      enabled: true,
    });
  });

  it('lists enabled keys from entitlement rows', async () => {
    const prisma = {
      isEnabled: () => true,
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ws1' }),
      },
      workspaceTool: {
        findMany: jest.fn().mockResolvedValue([
          { toolKey: 'vibestandup', enabled: true },
          { toolKey: 'addons.github', enabled: false },
        ]),
      },
    } as unknown as PrismaService;
    const service = new WorkspacesService(prisma);
    await expect(service.listEnabledToolKeys('ws1')).resolves.toEqual([
      'vibestandup',
    ]);
  });

  it('throws when workspace is missing', async () => {
    const prisma = {
      isEnabled: () => true,
      workspace: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new WorkspacesService(prisma);
    await expect(service.listTools('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
