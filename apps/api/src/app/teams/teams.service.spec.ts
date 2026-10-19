import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TeamInviteStatus, TeamRole, WorkspaceRole } from '@prisma/client';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TeamsService } from './teams.service';

const admin: VerifiedUser = { uid: 'uid-admin', email: 'admin@example.com' };
const invitee: VerifiedUser = {
  uid: 'uid-invitee',
  email: 'invitee@example.com',
};

describe('TeamsService invites and plan limits', () => {
  function build(prisma: unknown, users?: Partial<UsersService>): TeamsService {
    const usersService = {
      upsertFromFirebase: jest
        .fn()
        .mockImplementation(async (user: VerifiedUser) => ({
          id: user.uid === 'uid-admin' ? 'user-admin' : 'user-invitee',
          email: user.email,
        })),
      ...users,
    } as unknown as UsersService;
    return new TeamsService(prisma as PrismaService, usersService);
  }

  it('creates a pending invite when email is unknown', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'inv1',
      teamId: 'team1',
      email: 'new@example.com',
      role: TeamRole.MEMBER,
      status: TeamInviteStatus.PENDING,
      token: 'tok',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const prisma = {
      isEnabled: () => true,
      teamMember: {
        findUnique: jest.fn().mockResolvedValue({
          role: TeamRole.ADMIN,
          team: { workspaceId: 'ws1' },
        }),
        count: jest.fn().mockResolvedValue(1),
      },
      team: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'team1', workspaceId: 'ws1' }),
      },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      teamInvite: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create,
      },
    };
    const service = build(prisma);
    const result = await service.createInviteByEmail(
      'team1',
      admin,
      'New@Example.com',
    );
    expect(result.email).toBe('new@example.com');
    expect(result.acceptPath).toBe('/invite/tok');
    expect(result.status).toBe('PENDING');
    expect(create).toHaveBeenCalled();
  });

  it('adds workspace + team membership immediately when email exists', async () => {
    const prisma = {
      isEnabled: () => true,
      teamMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            role: TeamRole.ADMIN,
            team: { workspaceId: 'ws1' },
          })
          .mockResolvedValueOnce(null),
        count: jest.fn().mockResolvedValue(1),
        upsert: jest.fn().mockResolvedValue({
          id: 'tm1',
          userId: 'user-existing',
          role: TeamRole.MEMBER,
          user: { email: 'existing@example.com', displayName: 'Ex' },
        }),
      },
      team: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'team1', workspaceId: 'ws1' }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-existing',
          email: 'existing@example.com',
        }),
      },
      workspaceMember: { upsert: jest.fn().mockResolvedValue({}) },
      teamInvite: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'inv1',
          teamId: 'team1',
          email: 'existing@example.com',
          role: TeamRole.MEMBER,
          status: TeamInviteStatus.ACCEPTED,
          token: 'tok2',
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
    };
    const service = build(prisma);
    const result = await service.createInviteByEmail(
      'team1',
      admin,
      'existing@example.com',
    );
    expect(result.status).toBe('ACCEPTED');
    expect(result.member?.userId).toBe('user-existing');
    expect(prisma.workspaceMember.upsert).toHaveBeenCalled();
  });

  it('rejects accept when signed-in email does not match invite', async () => {
    const prisma = {
      isEnabled: () => true,
      teamInvite: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv1',
          teamId: 'team1',
          email: 'other@example.com',
          role: TeamRole.MEMBER,
          status: TeamInviteStatus.PENDING,
          token: 'tok',
          expiresAt: new Date(Date.now() + 60_000),
          team: { workspaceId: 'ws1' },
        }),
      },
    };
    const service = build(prisma, {
      upsertFromFirebase: jest.fn().mockResolvedValue({
        id: 'user-invitee',
        email: 'invitee@example.com',
      }),
    });
    await expect(service.acceptInvite('tok', invitee)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('enforces max teams on create', async () => {
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: WorkspaceRole.OWNER }),
      },
      team: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = build(prisma);
    await expect(
      service.create('ws1', admin, 'Second', 'second'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found for unknown invite token', async () => {
    const prisma = {
      isEnabled: () => true,
      teamInvite: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = build(prisma);
    await expect(
      service.acceptInvite('missing', invitee),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
