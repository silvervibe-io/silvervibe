import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  MeetingClosePolicy,
  MeetingEditPolicy,
  MeetingStatus,
  WorkspaceRole,
} from '@prisma/client';
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  CloseMeetingDto,
  CreateMeetingDto,
  MeetingDetailDto,
  MeetingMemberDto,
  MeetingSummaryDto,
  SetMeetingActionsDto,
  SetMeetingDecisionsDto,
  SetMeetingInvitesDto,
  UpdateMeetingSettingsDto,
} from './meetings.dto';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for meetings',
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

  private async requireVibemeetingEnabled(workspaceId: string): Promise<void> {
    const tool = await this.prisma.workspaceTool.findUnique({
      where: {
        workspaceId_toolKey: {
          workspaceId,
          toolKey: TOOL_KEYS.vibemeeting,
        },
      },
    });
    if (!tool?.enabled) {
      throw new ForbiddenException(
        'VibeMeeting is not enabled for this workspace',
      );
    }
  }

  private async loadMeetingOrThrow(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        agendaItems: { orderBy: { sortOrder: 'asc' } },
        invites: {
          include: {
            user: { select: { id: true, email: true, displayName: true } },
          },
        },
        decisions: { orderBy: { sortOrder: 'asc' } },
        actions: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!meeting) {
      throw new NotFoundException(`Meeting ${meetingId} not found`);
    }
    return meeting;
  }

  private assertCanAccess(
    meeting: { createdById: string; invites: { userId: string }[] },
    userId: string,
  ): void {
    if (meeting.createdById === userId) {
      return;
    }
    if (meeting.invites.some((invite) => invite.userId === userId)) {
      return;
    }
    throw new ForbiddenException('Not invited to this meeting');
  }

  private isWorkspaceAdmin(role: WorkspaceRole): boolean {
    return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
  }

  private canEditSettings(
    meeting: { createdById: string; status: MeetingStatus },
    userId: string,
    role: WorkspaceRole,
  ): boolean {
    if (meeting.status === MeetingStatus.CLOSED) {
      return false;
    }
    return meeting.createdById === userId || this.isWorkspaceAdmin(role);
  }

  private matchesPolicy(
    policy: MeetingEditPolicy | MeetingClosePolicy,
    meeting: { createdById: string; invites: { userId: string }[] },
    userId: string,
    role: WorkspaceRole,
  ): boolean {
    switch (policy) {
      case MeetingEditPolicy.CREATOR_ONLY:
        return meeting.createdById === userId;
      case MeetingEditPolicy.ANY_INVITEE:
        return (
          meeting.createdById === userId ||
          meeting.invites.some((invite) => invite.userId === userId)
        );
      case MeetingEditPolicy.CREATOR_OR_ADMIN:
      default:
        return meeting.createdById === userId || this.isWorkspaceAdmin(role);
    }
  }

  private canEditNotes(
    meeting: {
      createdById: string;
      status: MeetingStatus;
      editPolicy: MeetingEditPolicy;
      invites: { userId: string }[];
    },
    userId: string,
    role: WorkspaceRole,
  ): boolean {
    if (meeting.status !== MeetingStatus.OPEN) {
      return false;
    }
    return this.matchesPolicy(meeting.editPolicy, meeting, userId, role);
  }

  private canClose(
    meeting: {
      createdById: string;
      closePolicy: MeetingClosePolicy;
      status: MeetingStatus;
      invites: { userId: string }[];
    },
    userId: string,
    role: WorkspaceRole,
  ): boolean {
    if (meeting.status === MeetingStatus.CLOSED) {
      return false;
    }
    return this.matchesPolicy(meeting.closePolicy, meeting, userId, role);
  }

  private normalizeTexts(items: string[], label: string): string[] {
    const normalized = items
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
    if (normalized.length !== items.length) {
      throw new BadRequestException(`${label} must not be empty`);
    }
    return normalized;
  }

  private parseDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid scheduledAt');
    }
    return date;
  }

  private async assertWorkspaceMembers(
    workspaceId: string,
    userIds: Set<string>,
    message: string,
  ): Promise<void> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: [...userIds] } },
      select: { userId: true },
    });
    if (members.length !== userIds.size) {
      throw new BadRequestException(message);
    }
  }

  private toSummary(meeting: {
    id: string;
    workspaceId: string;
    title: string;
    context: string | null;
    status: MeetingStatus;
    editPolicy: MeetingEditPolicy;
    closePolicy: MeetingClosePolicy;
    scheduledAt: Date | null;
    createdById: string;
    createdAt: Date;
    invites: unknown[];
    agendaItems: unknown[];
    decisions: unknown[];
    actions: unknown[];
  }): MeetingSummaryDto {
    return {
      id: meeting.id,
      workspaceId: meeting.workspaceId,
      title: meeting.title,
      context: meeting.context,
      status: meeting.status,
      editPolicy: meeting.editPolicy,
      closePolicy: meeting.closePolicy,
      scheduledAt: meeting.scheduledAt?.toISOString() ?? null,
      createdById: meeting.createdById,
      createdAt: meeting.createdAt.toISOString(),
      inviteCount: meeting.invites.length,
      agendaCount: meeting.agendaItems.length,
      decisionCount: meeting.decisions.length,
      actionCount: meeting.actions.length,
    };
  }

  private toDetail(
    meeting: Awaited<ReturnType<MeetingsService['loadMeetingOrThrow']>>,
    userId: string,
    role: WorkspaceRole,
  ): MeetingDetailDto {
    return {
      ...this.toSummary(meeting),
      recap: meeting.recap,
      invites: meeting.invites.map((invite) => ({
        userId: invite.userId,
        email: invite.user.email,
        displayName: invite.user.displayName,
      })),
      agendaItems: meeting.agendaItems.map((item) => ({
        id: item.id,
        body: item.body,
        sortOrder: item.sortOrder,
      })),
      decisions: meeting.decisions.map((decision) => ({
        id: decision.id,
        body: decision.body,
        sortOrder: decision.sortOrder,
        createdById: decision.createdById,
        createdAt: decision.createdAt.toISOString(),
        updatedAt: decision.updatedAt.toISOString(),
      })),
      actions: meeting.actions.map((action) => ({
        id: action.id,
        body: action.body,
        assigneeId: action.assigneeId,
        done: action.done,
        sortOrder: action.sortOrder,
        createdById: action.createdById,
        createdAt: action.createdAt.toISOString(),
        updatedAt: action.updatedAt.toISOString(),
      })),
      canEditNotes: this.canEditNotes(meeting, userId, role),
      canClose: this.canClose(meeting, userId, role),
      canEditSettings: this.canEditSettings(meeting, userId, role),
    };
  }

  /** Loads a meeting and verifies membership, entitlement, and invite access. */
  private async loadForMember(meetingId: string, user: VerifiedUser) {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const meeting = await this.loadMeetingOrThrow(meetingId);
    const membership = await this.requireWorkspaceMember(
      meeting.workspaceId,
      userId,
    );
    await this.requireVibemeetingEnabled(meeting.workspaceId);
    return { userId, meeting, role: membership.role };
  }

  async listWorkspaceMembers(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<MeetingMemberDto[]> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireVibemeetingEnabled(workspaceId);

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
    body: CreateMeetingDto,
  ): Promise<MeetingDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const membership = await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireVibemeetingEnabled(workspaceId);

    const agendaItems = this.normalizeTexts(body.agendaItems, 'Agenda items');
    const scheduledAt = this.parseDate(body.scheduledAt) ?? null;

    const inviteIds = new Set(
      body.inviteUserIds.filter((id) => typeof id === 'string' && id.trim()),
    );
    inviteIds.add(userId);
    await this.assertWorkspaceMembers(
      workspaceId,
      inviteIds,
      'All invitees must be members of this workspace',
    );

    const created = await this.prisma.meeting.create({
      data: {
        workspaceId,
        createdById: userId,
        title: body.title.trim(),
        context: body.context?.trim() || null,
        editPolicy: body.editPolicy,
        closePolicy: body.closePolicy,
        status: MeetingStatus.OPEN,
        scheduledAt,
        agendaItems: {
          create: agendaItems.map((item, index) => ({
            body: item,
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

    const loaded = await this.loadMeetingOrThrow(created.id);
    return this.toDetail(loaded, userId, membership.role);
  }

  async list(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<MeetingSummaryDto[]> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireVibemeetingEnabled(workspaceId);

    const meetings = await this.prisma.meeting.findMany({
      where: {
        workspaceId,
        OR: [{ createdById: userId }, { invites: { some: { userId } } }],
      },
      include: {
        invites: true,
        agendaItems: true,
        decisions: true,
        actions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return meetings.map((meeting) => this.toSummary(meeting));
  }

  async get(meetingId: string, user: VerifiedUser): Promise<MeetingDetailDto> {
    const { userId, meeting, role } = await this.loadForMember(meetingId, user);
    this.assertCanAccess(meeting, userId);
    return this.toDetail(meeting, userId, role);
  }

  async updateSettings(
    meetingId: string,
    user: VerifiedUser,
    body: UpdateMeetingSettingsDto,
  ): Promise<MeetingDetailDto> {
    const { userId, meeting, role } = await this.loadForMember(meetingId, user);
    if (!this.canEditSettings(meeting, userId, role)) {
      throw new ForbiddenException(
        'Only the creator or a workspace admin can edit settings while the meeting is not closed',
      );
    }

    const scheduledAt = this.parseDate(body.scheduledAt);
    const agendaItems =
      body.agendaItems !== undefined
        ? this.normalizeTexts(body.agendaItems, 'Agenda items')
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          ...(body.title !== undefined ? { title: body.title.trim() } : {}),
          ...(body.context !== undefined
            ? {
                context:
                  body.context === null ? null : body.context.trim() || null,
              }
            : {}),
          ...(body.editPolicy ? { editPolicy: body.editPolicy } : {}),
          ...(body.closePolicy ? { closePolicy: body.closePolicy } : {}),
          ...(scheduledAt !== undefined ? { scheduledAt } : {}),
        },
      });

      if (agendaItems) {
        await tx.meetingAgendaItem.deleteMany({ where: { meetingId } });
        await tx.meetingAgendaItem.createMany({
          data: agendaItems.map((item, index) => ({
            meetingId,
            body: item,
            sortOrder: index,
          })),
        });
      }
    });

    const loaded = await this.loadMeetingOrThrow(meetingId);
    return this.toDetail(loaded, userId, role);
  }

  async setInvites(
    meetingId: string,
    user: VerifiedUser,
    body: SetMeetingInvitesDto,
  ): Promise<MeetingDetailDto> {
    const { userId, meeting, role } = await this.loadForMember(meetingId, user);
    if (!this.canEditSettings(meeting, userId, role)) {
      throw new ForbiddenException(
        'Only the creator or a workspace admin can invite',
      );
    }

    const inviteIds = new Set(
      body.userIds.filter((id) => typeof id === 'string' && id.trim()),
    );
    inviteIds.add(meeting.createdById);
    await this.assertWorkspaceMembers(
      meeting.workspaceId,
      inviteIds,
      'All invitees must be members of this workspace',
    );

    await this.prisma.$transaction([
      this.prisma.meetingInvite.deleteMany({
        where: { meetingId, userId: { notIn: [...inviteIds] } },
      }),
      ...[...inviteIds].map((inviteUserId) =>
        this.prisma.meetingInvite.upsert({
          where: {
            meetingId_userId: { meetingId, userId: inviteUserId },
          },
          create: { meetingId, userId: inviteUserId },
          update: {},
        }),
      ),
    ]);

    const loaded = await this.loadMeetingOrThrow(meetingId);
    return this.toDetail(loaded, userId, role);
  }

  private assertCanEditNotes(
    meeting: {
      createdById: string;
      status: MeetingStatus;
      editPolicy: MeetingEditPolicy;
      invites: { userId: string }[];
    },
    userId: string,
    role: WorkspaceRole,
  ): void {
    this.assertCanAccess(meeting, userId);
    if (meeting.status !== MeetingStatus.OPEN) {
      throw new BadRequestException('This meeting is not open for editing');
    }
    if (!this.canEditNotes(meeting, userId, role)) {
      throw new ForbiddenException(
        'You cannot edit decisions or actions for this meeting',
      );
    }
  }

  async setDecisions(
    meetingId: string,
    user: VerifiedUser,
    body: SetMeetingDecisionsDto,
  ): Promise<MeetingDetailDto> {
    const { userId, meeting, role } = await this.loadForMember(meetingId, user);
    this.assertCanEditNotes(meeting, userId, role);

    const bodies = this.normalizeTexts(
      body.decisions.map((decision) => decision.body),
      'Decisions',
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.meetingDecision.deleteMany({ where: { meetingId } });
      if (bodies.length > 0) {
        await tx.meetingDecision.createMany({
          data: bodies.map((text, index) => ({
            meetingId,
            body: text,
            sortOrder: index,
            createdById: userId,
          })),
        });
      }
    });

    const loaded = await this.loadMeetingOrThrow(meetingId);
    return this.toDetail(loaded, userId, role);
  }

  async setActions(
    meetingId: string,
    user: VerifiedUser,
    body: SetMeetingActionsDto,
  ): Promise<MeetingDetailDto> {
    const { userId, meeting, role } = await this.loadForMember(meetingId, user);
    this.assertCanEditNotes(meeting, userId, role);

    const bodies = this.normalizeTexts(
      body.actions.map((action) => action.body),
      'Actions',
    );

    const assigneeIds = new Set(
      body.actions
        .map((action) => action.assigneeId)
        .filter((id): id is string => typeof id === 'string' && !!id.trim()),
    );
    if (assigneeIds.size > 0) {
      await this.assertWorkspaceMembers(
        meeting.workspaceId,
        assigneeIds,
        'All assignees must be members of this workspace',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.meetingAction.deleteMany({ where: { meetingId } });
      if (bodies.length > 0) {
        await tx.meetingAction.createMany({
          data: body.actions.map((action, index) => ({
            meetingId,
            body: bodies[index],
            assigneeId: action.assigneeId?.trim() || null,
            done: action.done ?? false,
            sortOrder: index,
            createdById: userId,
          })),
        });
      }
    });

    const loaded = await this.loadMeetingOrThrow(meetingId);
    return this.toDetail(loaded, userId, role);
  }

  async close(
    meetingId: string,
    user: VerifiedUser,
    body: CloseMeetingDto,
  ): Promise<MeetingDetailDto> {
    const { userId, meeting, role } = await this.loadForMember(meetingId, user);
    this.assertCanAccess(meeting, userId);
    if (!this.canClose(meeting, userId, role)) {
      throw new ForbiddenException('You cannot close this meeting');
    }

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: MeetingStatus.CLOSED,
        recap: body.recap?.trim() || meeting.recap,
      },
    });

    const loaded = await this.loadMeetingOrThrow(meetingId);
    return this.toDetail(loaded, userId, role);
  }
}
