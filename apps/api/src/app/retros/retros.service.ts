import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  RetroClosePolicy,
  RetroNoteColumn,
  RetroNoteVisibility,
  RetroStatus,
  WorkspaceRole,
} from '@prisma/client';
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  CloseRetroDto,
  CreateRetroDto,
  RetroDetailDto,
  RetroSummaryDto,
  SetRetroInvitesDto,
  UpdateRetroSettingsDto,
  UpsertRetroNoteDto,
  WorkspaceMemberDto,
} from './retro.dto';

@Injectable()
export class RetrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for retros',
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

  private async requireViberetroEnabled(workspaceId: string): Promise<void> {
    const tool = await this.prisma.workspaceTool.findUnique({
      where: {
        workspaceId_toolKey: {
          workspaceId,
          toolKey: TOOL_KEYS.viberetro,
        },
      },
    });
    if (!tool?.enabled) {
      throw new ForbiddenException(
        'VibeRetro is not enabled for this workspace',
      );
    }
  }

  private async loadRetroOrThrow(retroId: string) {
    const retro = await this.prisma.retro.findUnique({
      where: { id: retroId },
      include: {
        invites: {
          include: {
            user: { select: { id: true, email: true, displayName: true } },
          },
        },
        notes: {
          include: {
            author: { select: { id: true, displayName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!retro) {
      throw new NotFoundException(`Retro ${retroId} not found`);
    }
    return retro;
  }

  private assertCanAccess(
    retro: { createdById: string; invites: { userId: string }[] },
    userId: string,
  ): void {
    if (retro.createdById === userId) {
      return;
    }
    if (retro.invites.some((invite) => invite.userId === userId)) {
      return;
    }
    throw new ForbiddenException('Not invited to this retro');
  }

  private isWorkspaceAdmin(role: WorkspaceRole): boolean {
    return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
  }

  private canEditSettings(
    retro: { createdById: string; status: RetroStatus },
    userId: string,
    role: WorkspaceRole,
  ): boolean {
    if (retro.status === RetroStatus.CLOSED) {
      return false;
    }
    return retro.createdById === userId || this.isWorkspaceAdmin(role);
  }

  private canClose(
    retro: {
      createdById: string;
      closePolicy: RetroClosePolicy;
      status: RetroStatus;
      invites: { userId: string }[];
    },
    userId: string,
    role: WorkspaceRole,
  ): boolean {
    if (retro.status === RetroStatus.CLOSED) {
      return false;
    }
    switch (retro.closePolicy) {
      case RetroClosePolicy.CREATOR_ONLY:
        return retro.createdById === userId;
      case RetroClosePolicy.ANY_INVITEE:
        return (
          retro.createdById === userId ||
          retro.invites.some((invite) => invite.userId === userId)
        );
      case RetroClosePolicy.CREATOR_OR_ADMIN:
      default:
        return retro.createdById === userId || this.isWorkspaceAdmin(role);
    }
  }

  private canAddNotes(retro: {
    status: RetroStatus;
    endsAt: Date | null;
  }): boolean {
    if (retro.status !== RetroStatus.OPEN) {
      return false;
    }
    if (retro.endsAt && retro.endsAt.getTime() < Date.now()) {
      return false;
    }
    return true;
  }

  private filterNotes(
    retro: {
      status: RetroStatus;
      noteVisibility: RetroNoteVisibility;
      notes: Array<{
        id: string;
        column: RetroNoteColumn;
        body: string;
        authorId: string;
        createdAt: Date;
        updatedAt: Date;
        author: { id: string; displayName: string | null };
      }>;
    },
    userId: string,
  ) {
    const hasContributed = retro.notes.some((note) => note.authorId === userId);
    let visible = retro.notes;
    if (retro.status === RetroStatus.CLOSED) {
      visible = retro.notes;
    } else if (
      retro.noteVisibility === RetroNoteVisibility.PRIVATE_UNTIL_CLOSE
    ) {
      visible = retro.notes.filter((note) => note.authorId === userId);
    } else if (
      retro.noteVisibility === RetroNoteVisibility.AFTER_CONTRIBUTE &&
      !hasContributed
    ) {
      visible = retro.notes.filter((note) => note.authorId === userId);
    }

    return visible.map((note) => ({
      id: note.id,
      column: note.column,
      body: note.body,
      authorId: note.authorId,
      authorDisplayName: note.author.displayName,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      mine: note.authorId === userId,
    }));
  }

  private toSummary(
    retro: {
      id: string;
      workspaceId: string;
      title: string;
      status: RetroStatus;
      noteVisibility: RetroNoteVisibility;
      closePolicy: RetroClosePolicy;
      endsAt: Date | null;
      createdById: string;
      createdAt: Date;
      invites: unknown[];
      notes: { authorId: string }[];
    },
    userId: string,
  ): RetroSummaryDto {
    return {
      id: retro.id,
      workspaceId: retro.workspaceId,
      title: retro.title,
      status: retro.status,
      noteVisibility: retro.noteVisibility,
      closePolicy: retro.closePolicy,
      endsAt: retro.endsAt?.toISOString() ?? null,
      createdById: retro.createdById,
      createdAt: retro.createdAt.toISOString(),
      inviteCount: retro.invites.length,
      noteCount: retro.notes.length,
      hasContributed: retro.notes.some((note) => note.authorId === userId),
    };
  }

  private toDetail(
    retro: Awaited<ReturnType<RetrosService['loadRetroOrThrow']>>,
    userId: string,
    role: WorkspaceRole,
  ): RetroDetailDto {
    return {
      ...this.toSummary(retro, userId),
      summary: retro.summary,
      invites: retro.invites.map((invite) => ({
        userId: invite.userId,
        email: invite.user.email,
        displayName: invite.user.displayName,
      })),
      notes: this.filterNotes(retro, userId),
      canAddNotes: this.canAddNotes(retro),
      canClose: this.canClose(retro, userId, role),
      canEditSettings: this.canEditSettings(retro, userId, role),
    };
  }

  async listWorkspaceMembers(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<WorkspaceMemberDto[]> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireViberetroEnabled(workspaceId);

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
    body: CreateRetroDto,
  ): Promise<RetroDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const membership = await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireViberetroEnabled(workspaceId);

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

    const created = await this.prisma.retro.create({
      data: {
        workspaceId,
        createdById: userId,
        title: body.title.trim(),
        noteVisibility: body.noteVisibility,
        closePolicy: body.closePolicy,
        status: RetroStatus.OPEN,
        endsAt,
        invites: {
          create: [...inviteIds].map((inviteUserId) => ({
            userId: inviteUserId,
          })),
        },
      },
    });

    const loaded = await this.loadRetroOrThrow(created.id);
    return this.toDetail(loaded, userId, membership.role);
  }

  async list(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<RetroSummaryDto[]> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceMember(workspaceId, userId);
    await this.requireViberetroEnabled(workspaceId);

    const retros = await this.prisma.retro.findMany({
      where: {
        workspaceId,
        OR: [{ createdById: userId }, { invites: { some: { userId } } }],
      },
      include: {
        invites: true,
        notes: { select: { authorId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return retros.map((retro) => this.toSummary(retro, userId));
  }

  async get(retroId: string, user: VerifiedUser): Promise<RetroDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const retro = await this.loadRetroOrThrow(retroId);
    const membership = await this.requireWorkspaceMember(
      retro.workspaceId,
      userId,
    );
    await this.requireViberetroEnabled(retro.workspaceId);
    this.assertCanAccess(retro, userId);
    return this.toDetail(retro, userId, membership.role);
  }

  async updateSettings(
    retroId: string,
    user: VerifiedUser,
    body: UpdateRetroSettingsDto,
  ): Promise<RetroDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const retro = await this.loadRetroOrThrow(retroId);
    const membership = await this.requireWorkspaceMember(
      retro.workspaceId,
      userId,
    );
    await this.requireViberetroEnabled(retro.workspaceId);
    if (!this.canEditSettings(retro, userId, membership.role)) {
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

    await this.prisma.retro.update({
      where: { id: retroId },
      data: {
        ...(body.noteVisibility ? { noteVisibility: body.noteVisibility } : {}),
        ...(body.closePolicy ? { closePolicy: body.closePolicy } : {}),
        ...(endsAt !== undefined ? { endsAt } : {}),
      },
    });

    const loaded = await this.loadRetroOrThrow(retroId);
    return this.toDetail(loaded, userId, membership.role);
  }

  async setInvites(
    retroId: string,
    user: VerifiedUser,
    body: SetRetroInvitesDto,
  ): Promise<RetroDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const retro = await this.loadRetroOrThrow(retroId);
    const membership = await this.requireWorkspaceMember(
      retro.workspaceId,
      userId,
    );
    await this.requireViberetroEnabled(retro.workspaceId);
    if (!this.canEditSettings(retro, userId, membership.role)) {
      throw new ForbiddenException(
        'Only the creator or a workspace admin can invite',
      );
    }

    const inviteIds = new Set(
      body.userIds.filter((id) => typeof id === 'string' && id.trim()),
    );
    inviteIds.add(retro.createdById);

    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId: retro.workspaceId,
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
      this.prisma.retroInvite.deleteMany({
        where: { retroId, userId: { notIn: [...inviteIds] } },
      }),
      ...[...inviteIds].map((inviteUserId) =>
        this.prisma.retroInvite.upsert({
          where: { retroId_userId: { retroId, userId: inviteUserId } },
          create: { retroId, userId: inviteUserId },
          update: {},
        }),
      ),
    ]);

    const loaded = await this.loadRetroOrThrow(retroId);
    return this.toDetail(loaded, userId, membership.role);
  }

  async addNote(
    retroId: string,
    user: VerifiedUser,
    body: UpsertRetroNoteDto,
  ): Promise<RetroDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const retro = await this.loadRetroOrThrow(retroId);
    const membership = await this.requireWorkspaceMember(
      retro.workspaceId,
      userId,
    );
    await this.requireViberetroEnabled(retro.workspaceId);
    this.assertCanAccess(retro, userId);
    if (!this.canAddNotes(retro)) {
      throw new BadRequestException('This retro is not open for notes');
    }

    await this.prisma.retroNote.create({
      data: {
        retroId,
        authorId: userId,
        column: body.column,
        body: body.body.trim(),
      },
    });

    const loaded = await this.loadRetroOrThrow(retroId);
    return this.toDetail(loaded, userId, membership.role);
  }

  async updateNote(
    retroId: string,
    noteId: string,
    user: VerifiedUser,
    body: UpsertRetroNoteDto,
  ): Promise<RetroDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const retro = await this.loadRetroOrThrow(retroId);
    const membership = await this.requireWorkspaceMember(
      retro.workspaceId,
      userId,
    );
    await this.requireViberetroEnabled(retro.workspaceId);
    this.assertCanAccess(retro, userId);
    if (!this.canAddNotes(retro)) {
      throw new BadRequestException('This retro is not open for notes');
    }

    const note = retro.notes.find((item) => item.id === noteId);
    if (!note || note.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own notes');
    }

    await this.prisma.retroNote.update({
      where: { id: noteId },
      data: { column: body.column, body: body.body.trim() },
    });

    const loaded = await this.loadRetroOrThrow(retroId);
    return this.toDetail(loaded, userId, membership.role);
  }

  async deleteNote(
    retroId: string,
    noteId: string,
    user: VerifiedUser,
  ): Promise<RetroDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const retro = await this.loadRetroOrThrow(retroId);
    const membership = await this.requireWorkspaceMember(
      retro.workspaceId,
      userId,
    );
    await this.requireViberetroEnabled(retro.workspaceId);
    this.assertCanAccess(retro, userId);
    if (!this.canAddNotes(retro)) {
      throw new BadRequestException('This retro is not open for notes');
    }

    const note = retro.notes.find((item) => item.id === noteId);
    if (!note || note.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own notes');
    }

    await this.prisma.retroNote.delete({ where: { id: noteId } });
    const loaded = await this.loadRetroOrThrow(retroId);
    return this.toDetail(loaded, userId, membership.role);
  }

  async close(
    retroId: string,
    user: VerifiedUser,
    body: CloseRetroDto,
  ): Promise<RetroDetailDto> {
    this.ensureDb();
    const userId = await this.resolveUserId(user);
    const retro = await this.loadRetroOrThrow(retroId);
    const membership = await this.requireWorkspaceMember(
      retro.workspaceId,
      userId,
    );
    await this.requireViberetroEnabled(retro.workspaceId);
    this.assertCanAccess(retro, userId);
    if (!this.canClose(retro, userId, membership.role)) {
      throw new ForbiddenException('You cannot close this retro');
    }

    await this.prisma.retro.update({
      where: { id: retroId },
      data: {
        status: RetroStatus.CLOSED,
        summary: body.summary?.trim() || retro.summary,
      },
    });

    const loaded = await this.loadRetroOrThrow(retroId);
    return this.toDetail(loaded, userId, membership.role);
  }
}
