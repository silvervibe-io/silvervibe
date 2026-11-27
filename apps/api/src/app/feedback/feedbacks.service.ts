import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  FeedbackAnswerVisibility,
  FeedbackClosePolicy,
  FeedbackStatus,
  WorkspaceRole,
} from '@prisma/client';
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  CloseFeedbackDto,
  CreateFeedbackRequestDto,
  FeedbackDetailDto,
  FeedbackSummaryDto,
  SetFeedbackInvitesDto,
  UpdateFeedbackSettingsDto,
  UpsertFeedbackAnswersDto,
  WorkspaceMemberDto,
} from './feedback.dto';

@Injectable()
export class FeedbacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for feedback',
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
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    return membership;
  }

  private async requireVibefeedbackEnabled(workspaceId: string): Promise<void> {
    const tool = await this.prisma.workspaceTool.findUnique({
      where: {
        workspaceId_toolKey: {
          workspaceId,
          toolKey: TOOL_KEYS.vibefeedback,
        },
      },
    });
    if (!tool?.enabled) {
      throw new ForbiddenException(
        'VibeFeedback is not enabled for this workspace',
      );
    }
  }

  private async loadRequestOrThrow(requestId: string) {
    const request = await this.prisma.feedbackRequest.findUnique({
      where: { id: requestId },
      include: {
        prompts: { orderBy: { sortOrder: 'asc' } },
        invites: {
          include: {
            user: { select: { id: true, email: true, displayName: true } },
          },
        },
        answers: {
          include: {
            author: { select: { id: true, displayName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!request) {
      throw new NotFoundException(`Feedback request ${requestId} not found`);
    }
    return request;
  }

  private assertCanAccess(
    request: { createdById: string; invites: { userId: string }[] },
    userId: string,
  ): void {
    if (request.createdById === userId) {
      return;
    }
    if (request.invites.some((invite) => invite.userId === userId)) {
      return;
    }
    throw new ForbiddenException('Not invited to this feedback request');
  }

  private isWorkspaceAdmin(role: WorkspaceRole): boolean {
    return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
  }

  private canEditSettings(
    request: { createdById: string; status: FeedbackStatus },
    userId: string,
    role: WorkspaceRole,
  ): boolean {
    if (request.status === FeedbackStatus.CLOSED) {
      return false;
    }
    return request.createdById === userId || this.isWorkspaceAdmin(role);
  }

  private canClose(
    request: {
      createdById: string;
      closePolicy: FeedbackClosePolicy;
      status: FeedbackStatus;
      invites: { userId: string }[];
    },
    userId: string,
    role: WorkspaceRole,
  ): boolean {
    if (request.status === FeedbackStatus.CLOSED) {
      return false;
    }
    switch (request.closePolicy) {
      case FeedbackClosePolicy.CREATOR_ONLY:
        return request.createdById === userId;
      case FeedbackClosePolicy.ANY_INVITEE:
        return (
          request.createdById === userId ||
          request.invites.some((invite) => invite.userId === userId)
        );
      case FeedbackClosePolicy.CREATOR_OR_ADMIN:
      default:
        return request.createdById === userId || this.isWorkspaceAdmin(role);
    }
  }

  private canAnswer(request: {
    status: FeedbackStatus;
    endsAt: Date | null;
  }): boolean {
    if (request.status !== FeedbackStatus.OPEN) {
      return false;
    }
    if (request.endsAt && request.endsAt.getTime() < Date.now()) {
      return false;
    }
    return true;
  }

  private normalizePrompts(prompts: string[]): string[] {
    const normalized = prompts
      .map((prompt) => (typeof prompt === 'string' ? prompt.trim() : ''))
      .filter((prompt) => prompt.length > 0);
    if (normalized.length === 0) {
      throw new BadRequestException(
        'At least one non-empty prompt is required',
      );
    }
    return normalized;
  }

  private filterAnswers(
    request: {
      createdById: string;
      answerVisibility: FeedbackAnswerVisibility;
      anonymous: boolean;
      answers: Array<{
        id: string;
        promptId: string;
        body: string;
        authorId: string;
        createdAt: Date;
        updatedAt: Date;
        author: { id: string; displayName: string | null };
      }>;
    },
    userId: string,
  ) {
    const isRequester = request.createdById === userId;
    let visible = request.answers;

    if (
      request.answerVisibility === FeedbackAnswerVisibility.PRIVATE_TO_REQUESTER
    ) {
      if (!isRequester) {
        visible = request.answers.filter(
          (answer) => answer.authorId === userId,
        );
      }
    }

    return visible.map((answer) => {
      const mine = answer.authorId === userId;
      if (request.anonymous && !mine) {
        return {
          id: answer.id,
          promptId: answer.promptId,
          body: answer.body,
          authorId: 'anonymous',
          authorDisplayName: null,
          createdAt: answer.createdAt.toISOString(),
          updatedAt: answer.updatedAt.toISOString(),
          mine: false,
        };
      }
      return {
        id: answer.id,
        promptId: answer.promptId,
        body: answer.body,
        authorId: answer.authorId,
        authorDisplayName: answer.author.displayName,
        createdAt: answer.createdAt.toISOString(),
        updatedAt: answer.updatedAt.toISOString(),
        mine,
      };
    });
  }

  private toSummary(
    request: {
      id: string;
      workspaceId: string;
      title: string;
      context: string | null;
      status: FeedbackStatus;
      answerVisibility: FeedbackAnswerVisibility;
      anonymous: boolean;
      closePolicy: FeedbackClosePolicy;
      endsAt: Date | null;
      createdById: string;
      createdAt: Date;
      invites: unknown[];
      prompts: unknown[];
      answers: { authorId: string }[];
    },
    userId: string,
  ): FeedbackSummaryDto {
    return {
      id: request.id,
      workspaceId: request.workspaceId,
      title: request.title,
      context: request.context,
      status: request.status,
      answerVisibility: request.answerVisibility,
      anonymous: request.anonymous,
      closePolicy: request.closePolicy,
      endsAt: request.endsAt?.toISOString() ?? null,
      createdById: request.createdById,
      createdAt: request.createdAt.toISOString(),
      inviteCount: request.invites.length,
      promptCount: request.prompts.length,
      answerCount: request.answers.length,
      hasContributed: request.answers.some(
        (answer) => answer.authorId === userId,
      ),
    };
  }

  private toDetail(
    request: Awaited<ReturnType<FeedbacksService['loadRequestOrThrow']>>,
    userId: string,
    role: WorkspaceRole,
  ): FeedbackDetailDto {
    return {
      ...this.toSummary(request, userId),
      summary: request.summary,
      invites: request.invites.map((invite) => ({
        userId: invite.userId,
        email: invite.user.email,
        displayName: invite.user.displayName,
      })),
      prompts: request.prompts.map((prompt) => ({
        id: prompt.id,
        body: prompt.body,
        sortOrder: prompt.sortOrder,
      })),
      answers: this.filterAnswers(request, userId),
      canAnswer: this.canAnswer(request),
      canClose: this.canClose(request, userId, role),
      canEditSettings: this.canEditSettings(request, userId, role),
    };
  }

  async listWorkspaceMembers(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<WorkspaceMemberDto[]> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireVibefeedbackEnabled(workspaceId);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member) => ({
      userId: member.userId,
      email: member.user.email,
      displayName: member.user.displayName,
      role: member.role,
    }));
  }

  async create(
    workspaceId: string,
    user: VerifiedUser,
    body: CreateFeedbackRequestDto,
  ): Promise<FeedbackDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const membership = await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireVibefeedbackEnabled(workspaceId);

    const prompts = this.normalizePrompts(body.prompts);

    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Invalid endsAt');
    }

    const inviteIds = new Set(
      body.inviteUserIds.filter((id) => typeof id === 'string' && id.trim()),
    );
    inviteIds.add(userId);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: [...inviteIds] } },
      select: { userId: true },
    });
    if (members.length !== inviteIds.size) {
      throw new BadRequestException(
        'All invitees must be members of this workspace',
      );
    }

    const created = await this.prisma.feedbackRequest.create({
      data: {
        workspaceId,
        createdById: userId,
        title: body.title.trim(),
        context: body.context?.trim() || null,
        answerVisibility: body.answerVisibility,
        anonymous: body.anonymous,
        closePolicy: body.closePolicy,
        status: FeedbackStatus.OPEN,
        endsAt,
        prompts: {
          create: prompts.map((prompt, index) => ({
            body: prompt,
            sortOrder: index,
          })),
        },
        invites: {
          create: [...inviteIds].map((inviteUserId) => ({
            userId: inviteUserId,
          })),
        },
      },
    });

    const loaded = await this.loadRequestOrThrow(created.id);
    return this.toDetail(loaded, userId, membership.role);
  }

  async list(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<FeedbackSummaryDto[]> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireVibefeedbackEnabled(workspaceId);

    const requests = await this.prisma.feedbackRequest.findMany({
      where: {
        workspaceId,
        OR: [{ createdById: userId }, { invites: { some: { userId } } }],
      },
      include: {
        invites: true,
        prompts: true,
        answers: { select: { authorId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => this.toSummary(request, userId));
  }

  async get(requestId: string, user: VerifiedUser): Promise<FeedbackDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const request = await this.loadRequestOrThrow(requestId);
    const membership = await this.requireWorkspaceMember(
      request.workspaceId,
      userId,
    );
    await this.requireVibefeedbackEnabled(request.workspaceId);
    this.assertCanAccess(request, userId);
    return this.toDetail(request, userId, membership.role);
  }

  async updateSettings(
    requestId: string,
    user: VerifiedUser,
    body: UpdateFeedbackSettingsDto,
  ): Promise<FeedbackDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const request = await this.loadRequestOrThrow(requestId);
    const membership = await this.requireWorkspaceMember(
      request.workspaceId,
      userId,
    );
    await this.requireVibefeedbackEnabled(request.workspaceId);
    if (!this.canEditSettings(request, userId, membership.role)) {
      throw new ForbiddenException(
        'Only the creator or a workspace admin can edit settings',
      );
    }

    let endsAt: Date | null | undefined = undefined;
    if (body.endsAt === null) {
      endsAt = null;
    } else if (typeof body.endsAt === 'string') {
      endsAt = new Date(body.endsAt);
      if (Number.isNaN(endsAt.getTime())) {
        throw new BadRequestException('Invalid endsAt');
      }
    }

    const prompts =
      body.prompts !== undefined
        ? this.normalizePrompts(body.prompts)
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.feedbackRequest.update({
        where: { id: requestId },
        data: {
          ...(body.title !== undefined ? { title: body.title.trim() } : {}),
          ...(body.context !== undefined
            ? {
                context:
                  body.context === null ? null : body.context.trim() || null,
              }
            : {}),
          ...(body.answerVisibility
            ? { answerVisibility: body.answerVisibility }
            : {}),
          ...(body.anonymous !== undefined
            ? { anonymous: body.anonymous }
            : {}),
          ...(body.closePolicy ? { closePolicy: body.closePolicy } : {}),
          ...(endsAt !== undefined ? { endsAt } : {}),
        },
      });

      if (prompts) {
        await tx.feedbackPrompt.deleteMany({ where: { requestId } });
        await tx.feedbackPrompt.createMany({
          data: prompts.map((prompt, index) => ({
            requestId,
            body: prompt,
            sortOrder: index,
          })),
        });
      }
    });

    const loaded = await this.loadRequestOrThrow(requestId);
    return this.toDetail(loaded, userId, membership.role);
  }

  async setInvites(
    requestId: string,
    user: VerifiedUser,
    body: SetFeedbackInvitesDto,
  ): Promise<FeedbackDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const request = await this.loadRequestOrThrow(requestId);
    const membership = await this.requireWorkspaceMember(
      request.workspaceId,
      userId,
    );
    await this.requireVibefeedbackEnabled(request.workspaceId);
    if (!this.canEditSettings(request, userId, membership.role)) {
      throw new ForbiddenException(
        'Only the creator or a workspace admin can invite',
      );
    }

    const inviteIds = new Set(
      body.userIds.filter((id) => typeof id === 'string' && id.trim()),
    );
    inviteIds.add(request.createdById);

    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId: request.workspaceId,
        userId: { in: [...inviteIds] },
      },
      select: { userId: true },
    });
    if (members.length !== inviteIds.size) {
      throw new BadRequestException(
        'All invitees must be members of this workspace',
      );
    }

    await this.prisma.$transaction([
      this.prisma.feedbackInvite.deleteMany({
        where: { requestId, userId: { notIn: [...inviteIds] } },
      }),
      ...[...inviteIds].map((inviteUserId) =>
        this.prisma.feedbackInvite.upsert({
          where: {
            requestId_userId: { requestId, userId: inviteUserId },
          },
          create: { requestId, userId: inviteUserId },
          update: {},
        }),
      ),
    ]);

    const loaded = await this.loadRequestOrThrow(requestId);
    return this.toDetail(loaded, userId, membership.role);
  }

  async upsertAnswers(
    requestId: string,
    user: VerifiedUser,
    body: UpsertFeedbackAnswersDto,
  ): Promise<FeedbackDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const request = await this.loadRequestOrThrow(requestId);
    const membership = await this.requireWorkspaceMember(
      request.workspaceId,
      userId,
    );
    await this.requireVibefeedbackEnabled(request.workspaceId);
    this.assertCanAccess(request, userId);
    if (!this.canAnswer(request)) {
      throw new BadRequestException(
        'This feedback request is not open for answers',
      );
    }

    if (!body.answers?.length) {
      throw new BadRequestException('At least one answer is required');
    }

    const promptIds = new Set(request.prompts.map((prompt) => prompt.id));
    for (const item of body.answers) {
      if (!promptIds.has(item.promptId)) {
        throw new BadRequestException(
          `Prompt ${item.promptId} does not belong to this request`,
        );
      }
    }

    await this.prisma.$transaction(
      body.answers.map((item) =>
        this.prisma.feedbackAnswer.upsert({
          where: {
            promptId_authorId: {
              promptId: item.promptId,
              authorId: userId,
            },
          },
          create: {
            requestId,
            promptId: item.promptId,
            authorId: userId,
            body: item.body.trim(),
          },
          update: { body: item.body.trim() },
        }),
      ),
    );

    const loaded = await this.loadRequestOrThrow(requestId);
    return this.toDetail(loaded, userId, membership.role);
  }

  async close(
    requestId: string,
    user: VerifiedUser,
    body: CloseFeedbackDto,
  ): Promise<FeedbackDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const request = await this.loadRequestOrThrow(requestId);
    const membership = await this.requireWorkspaceMember(
      request.workspaceId,
      userId,
    );
    await this.requireVibefeedbackEnabled(request.workspaceId);
    this.assertCanAccess(request, userId);
    if (!this.canClose(request, userId, membership.role)) {
      throw new ForbiddenException('You cannot close this feedback request');
    }

    await this.prisma.feedbackRequest.update({
      where: { id: requestId },
      data: {
        status: FeedbackStatus.CLOSED,
        summary: body.summary?.trim() || request.summary,
      },
    });

    const loaded = await this.loadRequestOrThrow(requestId);
    return this.toDetail(loaded, userId, membership.role);
  }
}
