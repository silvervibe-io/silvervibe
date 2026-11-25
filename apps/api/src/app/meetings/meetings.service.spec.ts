import { ForbiddenException } from '@nestjs/common';
import {
  MeetingClosePolicy,
  MeetingEditPolicy,
  MeetingStatus,
  WorkspaceRole,
} from '@prisma/client';
import { MeetingsService } from './meetings.service';

const user = { uid: 'firebase-1', email: 'a@example.com' };

function buildMeeting(
  overrides: Partial<{
    createdById: string;
    status: MeetingStatus;
    editPolicy: MeetingEditPolicy;
    closePolicy: MeetingClosePolicy;
  }> = {},
) {
  return {
    id: 'm-1',
    workspaceId: 'ws-1',
    createdById: 'user-2',
    title: 'Sprint planning',
    context: null,
    status: MeetingStatus.OPEN,
    editPolicy: MeetingEditPolicy.CREATOR_OR_ADMIN,
    closePolicy: MeetingClosePolicy.CREATOR_OR_ADMIN,
    scheduledAt: null,
    recap: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    agendaItems: [{ id: 'a1', body: 'Goals', sortOrder: 0 }],
    invites: [
      {
        userId: 'user-1',
        user: { id: 'user-1', email: null, displayName: null },
      },
    ],
    decisions: [],
    actions: [],
    ...overrides,
  };
}

describe('MeetingsService', () => {
  const prisma = {
    isEnabled: jest.fn(() => true),
    workspaceMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    workspaceTool: {
      findUnique: jest.fn(),
    },
    meeting: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    meetingAgendaItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    meetingDecision: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    meetingAction: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    meetingInvite: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(async (ops: unknown) => {
      if (typeof ops === 'function') {
        return ops(prisma);
      }
      return ops;
    }),
  };

  const users = {
    upsertFromFirebase: jest.fn(async () => ({ id: 'user-1' })),
  };

  let service: MeetingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.isEnabled.mockReturnValue(true);
    users.upsertFromFirebase.mockResolvedValue({ id: 'user-1' });
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });
    prisma.workspaceTool.findUnique.mockResolvedValue({ enabled: true });
    service = new MeetingsService(prisma as never, users as never);
  });

  it('rejects decision edits when edit policy is creator-only and caller is not creator', async () => {
    prisma.meeting.findUnique.mockResolvedValue(
      buildMeeting({ editPolicy: MeetingEditPolicy.CREATOR_ONLY }),
    );

    await expect(
      service.setDecisions('m-1', user as never, {
        decisions: [{ body: 'Ship it' }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.meetingDecision.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects action edits when edit policy is creator-only and caller is not creator', async () => {
    prisma.meeting.findUnique.mockResolvedValue(
      buildMeeting({ editPolicy: MeetingEditPolicy.CREATOR_ONLY }),
    );

    await expect(
      service.setActions('m-1', user as never, {
        actions: [{ body: 'Follow up' }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an invitee to replace decisions when edit policy is any-invitee', async () => {
    const open = buildMeeting({ editPolicy: MeetingEditPolicy.ANY_INVITEE });
    prisma.meeting.findUnique.mockResolvedValue(open);

    const detail = await service.setDecisions('m-1', user as never, {
      decisions: [{ body: 'Ship it' }],
    });

    expect(prisma.meetingDecision.deleteMany).toHaveBeenCalledWith({
      where: { meetingId: 'm-1' },
    });
    expect(prisma.meetingDecision.createMany).toHaveBeenCalledWith({
      data: [
        {
          meetingId: 'm-1',
          body: 'Ship it',
          sortOrder: 0,
          createdById: 'user-1',
        },
      ],
    });
    expect(detail.canEditNotes).toBe(true);
  });

  it('allows an invitee to close when close policy is any-invitee', async () => {
    const open = buildMeeting({ closePolicy: MeetingClosePolicy.ANY_INVITEE });
    prisma.meeting.findUnique
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce({
        ...open,
        status: MeetingStatus.CLOSED,
        recap: 'Done',
      });

    const detail = await service.close('m-1', user as never, {
      recap: 'Done',
    });

    expect(prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { status: MeetingStatus.CLOSED, recap: 'Done' },
    });
    expect(detail.status).toBe(MeetingStatus.CLOSED);
    expect(detail.recap).toBe('Done');
  });

  it('allows a workspace admin who is invited to close under creator-or-admin policy', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.ADMIN,
    });
    const open = buildMeeting();
    prisma.meeting.findUnique
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce({ ...open, status: MeetingStatus.CLOSED });

    const detail = await service.close('m-1', user as never, {});

    expect(detail.status).toBe(MeetingStatus.CLOSED);
  });

  it('rejects close when policy is creator-only and caller is not creator', async () => {
    prisma.meeting.findUnique.mockResolvedValue(
      buildMeeting({ closePolicy: MeetingClosePolicy.CREATOR_ONLY }),
    );

    await expect(
      service.close('m-1', user as never, { recap: 'Done' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.meeting.update).not.toHaveBeenCalled();
  });

  it('rejects entitlement-less workspaces', async () => {
    prisma.workspaceTool.findUnique.mockResolvedValue(null);

    await expect(
      service.listWorkspaceMembers('ws-1', user as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
