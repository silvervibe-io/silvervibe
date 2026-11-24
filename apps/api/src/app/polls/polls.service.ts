import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PollStatus, WorkspaceRole } from '@prisma/client';
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  CastVoteDto,
  CreatePollDto,
  PollDetailDto,
  PollResultsDto,
  PollSummaryDto,
  SetPollInvitesDto,
  WorkspaceMemberDto,
} from './poll.dto';

@Injectable()
export class PollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for polls',
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

  private async requireVibepollEnabled(workspaceId: string): Promise<void> {
    const tool = await this.prisma.workspaceTool.findUnique({
      where: {
        workspaceId_toolKey: {
          workspaceId,
          toolKey: TOOL_KEYS.vibepoll,
        },
      },
    });
    if (!tool?.enabled) {
      throw new ForbiddenException(
        'VibePoll is not enabled for this workspace',
      );
    }
  }

  private isWithinVoteWindow(poll: {
    status: PollStatus;
    startsAt: Date | null;
    endsAt: Date | null;
  }): boolean {
    if (poll.status !== PollStatus.OPEN) {
      return false;
    }
    const now = Date.now();
    if (poll.startsAt && poll.startsAt.getTime() > now) {
      return false;
    }
    if (poll.endsAt && poll.endsAt.getTime() < now) {
      return false;
    }
    return true;
  }

  private async loadPollOrThrow(pollId: string) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        invites: {
          include: {
            user: { select: { id: true, email: true, displayName: true } },
          },
        },
        votes: true,
      },
    });
    if (!poll) {
      throw new NotFoundException(`Poll ${pollId} not found`);
    }
    return poll;
  }

  private assertCanAccess(
    poll: { createdById: string; invites: { userId: string }[] },
    userId: string,
  ): void {
    if (poll.createdById === userId) {
      return;
    }
    if (poll.invites.some((invite) => invite.userId === userId)) {
      return;
    }
    throw new ForbiddenException('Not invited to this poll');
  }

  private toSummary(
    poll: {
      id: string;
      workspaceId: string;
      question: string;
      allowMulti: boolean;
      status: PollStatus;
      startsAt: Date | null;
      endsAt: Date | null;
      createdById: string;
      createdAt: Date;
      options: unknown[];
      invites: unknown[];
      votes: { userId: string }[];
    },
    userId: string,
  ): PollSummaryDto {
    return {
      id: poll.id,
      workspaceId: poll.workspaceId,
      question: poll.question,
      allowMulti: poll.allowMulti,
      status: poll.status,
      startsAt: poll.startsAt?.toISOString() ?? null,
      endsAt: poll.endsAt?.toISOString() ?? null,
      createdById: poll.createdById,
      createdAt: poll.createdAt.toISOString(),
      optionCount: poll.options.length,
      inviteCount: poll.invites.length,
      hasVoted: poll.votes.some((vote) => vote.userId === userId),
    };
  }

  private toDetail(
    poll: Awaited<ReturnType<PollsService['loadPollOrThrow']>>,
    userId: string,
    role: WorkspaceRole,
  ): PollDetailDto {
    const myOptionIds = poll.votes
      .filter((vote) => vote.userId === userId)
      .map((vote) => vote.optionId);
    const hasVoted = myOptionIds.length > 0;
    const canClose =
      poll.createdById === userId ||
      role === WorkspaceRole.OWNER ||
      role === WorkspaceRole.ADMIN;
    const canSeeResults =
      poll.status === PollStatus.CLOSED || hasVoted || canClose;
    return {
      ...this.toSummary(poll, userId),
      options: poll.options.map((option) => ({
        id: option.id,
        label: option.label,
        sortOrder: option.sortOrder,
      })),
      invites: poll.invites.map((invite) => ({
        userId: invite.userId,
        email: invite.user.email,
        displayName: invite.user.displayName,
      })),
      myOptionIds,
      canVote: this.isWithinVoteWindow(poll),
      canClose: canClose && poll.status !== PollStatus.CLOSED,
      canSeeResults,
    };
  }

  async listWorkspaceMembers(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<WorkspaceMemberDto[]> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireVibepollEnabled(workspaceId);

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
    body: CreatePollDto,
  ): Promise<PollDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const membership = await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireVibepollEnabled(workspaceId);

    const labels = body.options.map((label) => label.trim()).filter(Boolean);
    if (labels.length < 2) {
      throw new BadRequestException('At least two options are required');
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
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

    const poll = await this.prisma.poll.create({
      data: {
        workspaceId,
        createdById: userId,
        question: body.question.trim(),
        allowMulti: body.allowMulti,
        status: PollStatus.OPEN,
        startsAt,
        endsAt,
        options: {
          create: labels.map((label, index) => ({
            label,
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

    const loaded = await this.loadPollOrThrow(poll.id);
    return this.toDetail(loaded, userId, membership.role);
  }

  async list(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<PollSummaryDto[]> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireVibepollEnabled(workspaceId);

    const polls = await this.prisma.poll.findMany({
      where: {
        workspaceId,
        OR: [{ createdById: userId }, { invites: { some: { userId } } }],
      },
      include: {
        options: true,
        invites: true,
        votes: { select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return polls.map((poll) => this.toSummary(poll, userId));
  }

  async get(pollId: string, user: VerifiedUser): Promise<PollDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const poll = await this.loadPollOrThrow(pollId);
    const membership = await this.requireWorkspaceMember(
      poll.workspaceId,
      userId,
    );
    await this.requireVibepollEnabled(poll.workspaceId);
    this.assertCanAccess(poll, userId);
    return this.toDetail(poll, userId, membership.role);
  }

  async close(pollId: string, user: VerifiedUser): Promise<PollDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const poll = await this.loadPollOrThrow(pollId);
    const membership = await this.requireWorkspaceMember(
      poll.workspaceId,
      userId,
    );
    await this.requireVibepollEnabled(poll.workspaceId);

    const canClose =
      poll.createdById === userId ||
      membership.role === WorkspaceRole.OWNER ||
      membership.role === WorkspaceRole.ADMIN;
    if (!canClose) {
      throw new ForbiddenException(
        'Only the creator or a workspace admin can close',
      );
    }
    if (poll.status === PollStatus.CLOSED) {
      return this.toDetail(poll, userId, membership.role);
    }

    await this.prisma.poll.update({
      where: { id: pollId },
      data: { status: PollStatus.CLOSED },
    });
    const loaded = await this.loadPollOrThrow(pollId);
    return this.toDetail(loaded, userId, membership.role);
  }

  async setInvites(
    pollId: string,
    user: VerifiedUser,
    body: SetPollInvitesDto,
  ): Promise<PollDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const poll = await this.loadPollOrThrow(pollId);
    const membership = await this.requireWorkspaceMember(
      poll.workspaceId,
      userId,
    );
    await this.requireVibepollEnabled(poll.workspaceId);

    if (
      poll.createdById !== userId &&
      membership.role !== WorkspaceRole.OWNER &&
      membership.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only the creator or a workspace admin can invite',
      );
    }
    if (poll.status === PollStatus.CLOSED) {
      throw new BadRequestException('Cannot change invites on a closed poll');
    }

    const inviteIds = new Set(
      body.userIds.filter((id) => typeof id === 'string' && id.trim()),
    );
    inviteIds.add(poll.createdById);

    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId: poll.workspaceId,
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
      this.prisma.pollInvite.deleteMany({
        where: {
          pollId,
          userId: { notIn: [...inviteIds] },
        },
      }),
      ...[...inviteIds].map((inviteUserId) =>
        this.prisma.pollInvite.upsert({
          where: {
            pollId_userId: { pollId, userId: inviteUserId },
          },
          create: { pollId, userId: inviteUserId },
          update: {},
        }),
      ),
    ]);

    const loaded = await this.loadPollOrThrow(pollId);
    return this.toDetail(loaded, userId, membership.role);
  }

  async vote(
    pollId: string,
    user: VerifiedUser,
    body: CastVoteDto,
  ): Promise<PollDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const poll = await this.loadPollOrThrow(pollId);
    const membership = await this.requireWorkspaceMember(
      poll.workspaceId,
      userId,
    );
    await this.requireVibepollEnabled(poll.workspaceId);
    this.assertCanAccess(poll, userId);

    if (!this.isWithinVoteWindow(poll)) {
      throw new BadRequestException('This poll is not open for voting');
    }

    const optionIds = [...new Set(body.optionIds)];
    if (!poll.allowMulti && optionIds.length !== 1) {
      throw new BadRequestException('Select exactly one option');
    }
    const validIds = new Set(poll.options.map((option) => option.id));
    if (optionIds.some((id) => !validIds.has(id))) {
      throw new BadRequestException('Invalid option id');
    }

    await this.prisma.$transaction([
      this.prisma.pollVote.deleteMany({ where: { pollId, userId } }),
      this.prisma.pollVote.createMany({
        data: optionIds.map((optionId) => ({
          pollId,
          userId,
          optionId,
        })),
      }),
    ]);

    const loaded = await this.loadPollOrThrow(pollId);
    return this.toDetail(loaded, userId, membership.role);
  }

  async results(pollId: string, user: VerifiedUser): Promise<PollResultsDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const poll = await this.loadPollOrThrow(pollId);
    const membership = await this.requireWorkspaceMember(
      poll.workspaceId,
      userId,
    );
    await this.requireVibepollEnabled(poll.workspaceId);
    this.assertCanAccess(poll, userId);

    const hasVoted = poll.votes.some((vote) => vote.userId === userId);
    const canClose =
      poll.createdById === userId ||
      membership.role === WorkspaceRole.OWNER ||
      membership.role === WorkspaceRole.ADMIN;
    if (poll.status !== PollStatus.CLOSED && !hasVoted && !canClose) {
      throw new ForbiddenException('Vote before viewing results');
    }

    const ballotUsers = new Set(poll.votes.map((vote) => vote.userId));
    const counts = new Map<string, number>();
    for (const option of poll.options) {
      counts.set(option.id, 0);
    }
    for (const vote of poll.votes) {
      counts.set(vote.optionId, (counts.get(vote.optionId) ?? 0) + 1);
    }

    return {
      pollId,
      totalBallots: ballotUsers.size,
      options: poll.options.map((option) => ({
        optionId: option.id,
        label: option.label,
        voteCount: counts.get(option.id) ?? 0,
      })),
    };
  }
}
