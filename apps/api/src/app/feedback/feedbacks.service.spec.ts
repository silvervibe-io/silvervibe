import { ForbiddenException } from '@nestjs/common';
import {
  FeedbackAnswerVisibility,
  FeedbackClosePolicy,
  FeedbackStatus,
  WorkspaceRole,
} from '@prisma/client';
import { FeedbacksService } from './feedbacks.service';

const user = { uid: 'firebase-1', email: 'a@example.com' };

describe('FeedbacksService', () => {
  const prisma = {
    isEnabled: jest.fn(() => true),
    workspaceMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    workspaceTool: {
      findUnique: jest.fn(),
    },
    feedbackRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    feedbackPrompt: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    feedbackAnswer: {
      upsert: jest.fn(),
    },
    feedbackInvite: {
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

  let service: FeedbacksService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.isEnabled.mockReturnValue(true);
    users.upsertFromFirebase.mockResolvedValue({ id: 'user-1' });
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });
    prisma.workspaceTool.findUnique.mockResolvedValue({ enabled: true });
    service = new FeedbacksService(prisma as never, users as never);
  });

  it('hides other answers from invitee when visibility is private to requester', async () => {
    prisma.feedbackRequest.findUnique.mockResolvedValue({
      id: 'fb-1',
      workspaceId: 'ws-1',
      createdById: 'user-2',
      title: 'Q4 review',
      context: null,
      status: FeedbackStatus.OPEN,
      answerVisibility: FeedbackAnswerVisibility.PRIVATE_TO_REQUESTER,
      anonymous: false,
      closePolicy: FeedbackClosePolicy.CREATOR_OR_ADMIN,
      endsAt: null,
      summary: null,
      createdAt: new Date(),
      prompts: [{ id: 'p1', body: 'What went well?', sortOrder: 0 }],
      invites: [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: null, displayName: null },
        },
      ],
      answers: [
        {
          id: 'a1',
          promptId: 'p1',
          body: 'Requester note',
          authorId: 'user-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: 'user-2', displayName: 'Requester' },
        },
        {
          id: 'a2',
          promptId: 'p1',
          body: 'My answer',
          authorId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: 'user-1', displayName: 'Invitee' },
        },
      ],
    });

    const detail = await service.get('fb-1', user as never);
    expect(detail.answers).toHaveLength(1);
    expect(detail.answers[0]).toMatchObject({
      id: 'a2',
      body: 'My answer',
      mine: true,
    });
  });

  it('strips author identity from requester when answers are anonymous', async () => {
    users.upsertFromFirebase.mockResolvedValue({ id: 'user-2' });
    prisma.feedbackRequest.findUnique.mockResolvedValue({
      id: 'fb-1',
      workspaceId: 'ws-1',
      createdById: 'user-2',
      title: 'Anonymous pulse',
      context: null,
      status: FeedbackStatus.OPEN,
      answerVisibility: FeedbackAnswerVisibility.PRIVATE_TO_REQUESTER,
      anonymous: true,
      closePolicy: FeedbackClosePolicy.CREATOR_OR_ADMIN,
      endsAt: null,
      summary: null,
      createdAt: new Date(),
      prompts: [{ id: 'p1', body: 'Advice?', sortOrder: 0 }],
      invites: [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: null, displayName: 'Invitee' },
        },
        {
          userId: 'user-2',
          user: { id: 'user-2', email: null, displayName: 'Requester' },
        },
      ],
      answers: [
        {
          id: 'a1',
          promptId: 'p1',
          body: 'Ship smaller',
          authorId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: 'user-1', displayName: 'Invitee' },
        },
      ],
    });

    const detail = await service.get('fb-1', {
      uid: 'firebase-2',
      email: 'req@example.com',
    } as never);
    expect(detail.answers).toHaveLength(1);
    expect(detail.answers[0]).toMatchObject({
      body: 'Ship smaller',
      authorId: 'anonymous',
      authorDisplayName: null,
      mine: false,
    });
  });

  it('rejects close when policy is creator-only and caller is not creator', async () => {
    prisma.feedbackRequest.findUnique.mockResolvedValue({
      id: 'fb-1',
      workspaceId: 'ws-1',
      createdById: 'user-2',
      title: 'Q4 review',
      context: null,
      status: FeedbackStatus.OPEN,
      answerVisibility: FeedbackAnswerVisibility.SHARED_WITH_INVITEES,
      anonymous: false,
      closePolicy: FeedbackClosePolicy.CREATOR_ONLY,
      endsAt: null,
      summary: null,
      createdAt: new Date(),
      prompts: [{ id: 'p1', body: 'What went well?', sortOrder: 0 }],
      invites: [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: null, displayName: null },
        },
      ],
      answers: [],
    });

    await expect(
      service.close('fb-1', user as never, { summary: 'Done' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
