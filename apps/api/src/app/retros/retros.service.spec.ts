import { ForbiddenException } from '@nestjs/common';
import {
  RetroClosePolicy,
  RetroNoteVisibility,
  RetroStatus,
  WorkspaceRole,
} from '@prisma/client';
import { RetrosService } from './retros.service';

const user = { uid: 'firebase-1', email: 'a@example.com' };

describe('RetrosService', () => {
  const prisma = {
    isEnabled: jest.fn(() => true),
    workspaceMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    workspaceTool: {
      findUnique: jest.fn(),
    },
    retro: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    retroNote: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    retroInvite: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  };

  const users = {
    upsertFromFirebase: jest.fn(async () => ({ id: 'user-1' })),
  };

  let service: RetrosService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.isEnabled.mockReturnValue(true);
    users.upsertFromFirebase.mockResolvedValue({ id: 'user-1' });
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });
    prisma.workspaceTool.findUnique.mockResolvedValue({ enabled: true });
    service = new RetrosService(prisma as never, users as never);
  });

  it('hides other notes until the caller contributes', async () => {
    prisma.retro.findUnique.mockResolvedValue({
      id: 'retro-1',
      workspaceId: 'ws-1',
      createdById: 'user-2',
      title: 'Sprint 12',
      status: RetroStatus.OPEN,
      noteVisibility: RetroNoteVisibility.AFTER_CONTRIBUTE,
      closePolicy: RetroClosePolicy.CREATOR_OR_ADMIN,
      endsAt: null,
      summary: null,
      createdAt: new Date(),
      invites: [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: null, displayName: null },
        },
      ],
      notes: [
        {
          id: 'n1',
          column: 'WENT_WELL',
          body: 'Other note',
          authorId: 'user-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: 'user-2', displayName: 'Facilitator' },
        },
      ],
    });

    const detail = await service.get('retro-1', user as never);
    expect(detail.notes).toEqual([]);
    expect(detail.hasContributed).toBe(false);
  });

  it('rejects close when policy is creator-only', async () => {
    prisma.retro.findUnique.mockResolvedValue({
      id: 'retro-1',
      workspaceId: 'ws-1',
      createdById: 'user-2',
      title: 'Sprint 12',
      status: RetroStatus.OPEN,
      noteVisibility: RetroNoteVisibility.LIVE,
      closePolicy: RetroClosePolicy.CREATOR_ONLY,
      endsAt: null,
      summary: null,
      createdAt: new Date(),
      invites: [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: null, displayName: null },
        },
      ],
      notes: [],
    });

    await expect(
      service.close('retro-1', user as never, { summary: 'Done' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets any invitee close when policy allows', async () => {
    const open = {
      id: 'retro-1',
      workspaceId: 'ws-1',
      createdById: 'user-2',
      title: 'Sprint 12',
      status: RetroStatus.OPEN,
      noteVisibility: RetroNoteVisibility.LIVE,
      closePolicy: RetroClosePolicy.ANY_INVITEE,
      endsAt: null,
      summary: null,
      createdAt: new Date(),
      invites: [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: null, displayName: 'A' },
        },
      ],
      notes: [],
    };
    prisma.retro.findUnique.mockResolvedValueOnce(open).mockResolvedValueOnce({
      ...open,
      status: RetroStatus.CLOSED,
      summary: 'Wrapped',
    });

    const detail = await service.close('retro-1', user as never, {
      summary: 'Wrapped',
    });
    expect(prisma.retro.update).toHaveBeenCalled();
    expect(detail.status).toBe('CLOSED');
    expect(detail.summary).toBe('Wrapped');
  });
});
