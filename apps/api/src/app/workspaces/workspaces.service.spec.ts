import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from './workspaces.service';

const owner: VerifiedUser = {
  uid: 'uid-owner',
  email: 'owner@example.com',
};

const member: VerifiedUser = {
  uid: 'uid-member',
  email: 'member@example.com',
};

describe('WorkspacesService', () => {
  function buildService(prisma: unknown, users?: Partial<UsersService>) {
    const usersService = {
      upsertFromFirebase: jest
        .fn()
        .mockImplementation(async (user: VerifiedUser) => ({
          id: user.uid === 'uid-owner' ? 'user-owner' : 'user-member',
        })),
      ...users,
    } as unknown as UsersService;
    return new WorkspacesService(prisma as PrismaService, usersService);
  }

  it('rejects unknown tool keys', async () => {
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: WorkspaceRole.OWNER }),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ws1' }),
      },
    };
    const service = buildService(prisma);
    await expect(
      service.setToolEntitlement('ws1', 'not-a-tool', true, owner),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('grants a known tool via upsert when caller is admin', async () => {
    const upsert = jest.fn().mockResolvedValue({
      toolKey: TOOL_KEYS.vibestandup,
      enabled: true,
    });
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: WorkspaceRole.OWNER }),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ws1' }),
      },
      workspaceTool: { upsert },
    };
    const service = buildService(prisma);
    const result = await service.setToolEntitlement(
      'ws1',
      TOOL_KEYS.vibestandup,
      true,
      owner,
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

  it('forbids tool mutations for non-admin members', async () => {
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: WorkspaceRole.MEMBER }),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ws1' }),
      },
      workspaceTool: { upsert: jest.fn() },
    };
    const service = buildService(prisma);
    await expect(
      service.setToolEntitlement('ws1', TOOL_KEYS.vibestandup, true, member),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids listing tools for non-members', async () => {
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ws1' }),
      },
      workspaceTool: { findMany: jest.fn() },
    };
    const service = buildService(prisma);
    await expect(service.listTools('ws1', member)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
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
    };
    const service = buildService(prisma);
    await expect(service.listEnabledToolKeys('ws1')).resolves.toEqual([
      'vibestandup',
    ]);
  });

  it('throws when workspace is missing', async () => {
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: WorkspaceRole.OWNER }),
      },
      workspace: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = buildService(prisma);
    await expect(service.listTools('missing', owner)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets the owner set planKey to team', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'ws1',
      name: 'Demo',
      slug: 'demo',
      planKey: 'team',
    });
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: WorkspaceRole.OWNER }),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ws1' }),
        update,
      },
    };
    const service = buildService(prisma);
    await expect(service.setPlan('ws1', 'team', owner)).resolves.toEqual({
      id: 'ws1',
      name: 'Demo',
      slug: 'demo',
      planKey: 'team',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ws1' },
      data: { planKey: 'team' },
      select: { id: true, name: true, slug: true, planKey: true },
    });
  });

  it('forbids non-owners from setting planKey', async () => {
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: WorkspaceRole.ADMIN }),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ws1' }),
        update: jest.fn(),
      },
    };
    const service = buildService(prisma);
    await expect(service.setPlan('ws1', 'team', member)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
