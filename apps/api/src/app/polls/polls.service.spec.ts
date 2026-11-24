import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PollStatus, WorkspaceRole } from '@prisma/client';
import { PollsService } from './polls.service';

const user = { uid: 'firebase-1', email: 'a@example.com' };

describe('PollsService', () => {
  const prisma = {
    isEnabled: jest.fn(() => true),
    workspaceMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    workspaceTool: {
      findUnique: jest.fn(),
    },
    poll: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    pollVote: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    pollInvite: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  };

  const users = {
    upsertFromFirebase: jest.fn(async () => ({ id: 'user-1' })),
  };

  let service: PollsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.isEnabled.mockReturnValue(true);
    users.upsertFromFirebase.mockResolvedValue({ id: 'user-1' });
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });
    prisma.workspaceTool.findUnique.mockResolvedValue({ enabled: true });
    service = new PollsService(prisma as never, users as never);
  });

  it('rejects votes outside the open window', async () => {
    prisma.poll.findUnique.mockResolvedValue({
      id: 'poll-1',
      workspaceId: 'ws-1',
      createdById: 'user-1',
      allowMulti: false,
      status: PollStatus.OPEN,
      startsAt: new Date(Date.now() + 60_000),
      endsAt: null,
      options: [{ id: 'opt-1', label: 'A', sortOrder: 0 }],
      invites: [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: null, displayName: null },
        },
      ],
      votes: [],
      question: 'Q?',
      createdAt: new Date(),
    });

    await expect(
      service.vote('poll-1', user as never, { optionIds: ['opt-1'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects multi-select ballots when allowMulti is false', async () => {
    prisma.poll.findUnique.mockResolvedValue({
      id: 'poll-1',
      workspaceId: 'ws-1',
      createdById: 'user-1',
      allowMulti: false,
      status: PollStatus.OPEN,
      startsAt: null,
      endsAt: null,
      options: [
        { id: 'opt-1', label: 'A', sortOrder: 0 },
        { id: 'opt-2', label: 'B', sortOrder: 1 },
      ],
      invites: [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: null, displayName: null },
        },
      ],
      votes: [],
      question: 'Q?',
      createdAt: new Date(),
    });

    await expect(
      service.vote('poll-1', user as never, {
        optionIds: ['opt-1', 'opt-2'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('hides results until the caller has voted', async () => {
    prisma.poll.findUnique.mockResolvedValue({
      id: 'poll-1',
      workspaceId: 'ws-1',
      createdById: 'user-2',
      allowMulti: false,
      status: PollStatus.OPEN,
      startsAt: null,
      endsAt: null,
      options: [{ id: 'opt-1', label: 'A', sortOrder: 0 }],
      invites: [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: null, displayName: null },
        },
      ],
      votes: [{ userId: 'user-2', optionId: 'opt-1' }],
      question: 'Q?',
      createdAt: new Date(),
    });

    await expect(
      service.results('poll-1', user as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records a single-option vote', async () => {
    const openPoll = {
      id: 'poll-1',
      workspaceId: 'ws-1',
      createdById: 'user-1',
      allowMulti: false,
      status: PollStatus.OPEN,
      startsAt: null,
      endsAt: null,
      options: [
        { id: 'opt-1', label: 'A', sortOrder: 0 },
        { id: 'opt-2', label: 'B', sortOrder: 1 },
      ],
      invites: [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: 'a@example.com', displayName: 'A' },
        },
      ],
      votes: [] as { userId: string; optionId: string }[],
      question: 'Q?',
      createdAt: new Date(),
    };
    prisma.poll.findUnique
      .mockResolvedValueOnce(openPoll)
      .mockResolvedValueOnce({
        ...openPoll,
        votes: [{ userId: 'user-1', optionId: 'opt-1' }],
      });

    const detail = await service.vote('poll-1', user as never, {
      optionIds: ['opt-1'],
    });

    expect(prisma.pollVote.deleteMany).toHaveBeenCalledWith({
      where: { pollId: 'poll-1', userId: 'user-1' },
    });
    expect(prisma.pollVote.createMany).toHaveBeenCalled();
    expect(detail.myOptionIds).toEqual(['opt-1']);
    expect(detail.hasVoted).toBe(true);
  });
});
