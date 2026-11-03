import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TeamInviteStatus, TeamRole, WorkspaceRole } from '@prisma/client';
import {
  getVibestandupLimits,
  PLAN_KEYS,
  type PlanKey,
} from '@silvervibe/shared/feature-flags';
import { randomBytes } from 'crypto';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  AcceptTeamInviteDto,
  MyTeamDto,
  TeamDto,
  TeamInviteDto,
  TeamMemberDto,
} from './team.dto';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly mail: MailService,
  ) {}

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for teams',
      );
    }
  }

  private async resolveUserId(user: VerifiedUser): Promise<string> {
    const record = await this.users.upsertFromFirebase(user);
    return record.id;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toInviteDto(
    row: {
      id: string;
      teamId: string;
      email: string;
      role: TeamRole;
      status: TeamInviteStatus;
      token: string;
      expiresAt: Date;
    },
    mail?: { emailSent: boolean; emailError?: string },
  ): TeamInviteDto {
    return {
      id: row.id,
      teamId: row.teamId,
      email: row.email,
      role: row.role,
      status: row.status,
      token: row.token,
      acceptPath: `/invite/${row.token}`,
      expiresAt: row.expiresAt.toISOString(),
      ...(mail
        ? {
            emailSent: mail.emailSent,
            ...(mail.emailError ? { emailError: mail.emailError } : {}),
          }
        : {}),
    };
  }

  private inviteAcceptUrl(token: string): string {
    const base = (
      process.env['PUBLIC_STANDUP_URL'] ?? 'http://localhost:4201'
    ).replace(/\/$/, '');
    return `${base}/invite/${token}`;
  }

  private async sendInviteEmail(
    invite: { email: string; token: string; expiresAt: Date },
    teamName: string,
  ): Promise<{ emailSent: boolean; emailError?: string }> {
    const result = await this.mail.sendTeamInvite({
      to: invite.email,
      teamName,
      acceptUrl: this.inviteAcceptUrl(invite.token),
      expiresAt: invite.expiresAt,
    });
    return {
      emailSent: result.sent,
      ...(result.error ? { emailError: result.error } : {}),
    };
  }

  private toMemberDto(member: {
    id: string;
    userId: string;
    role: TeamRole;
    user: { email: string | null; displayName: string | null };
  }): TeamMemberDto {
    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      email: member.user.email,
      displayName: member.user.displayName,
    };
  }

  private async requireWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<{ role: WorkspaceRole }> {
    this.ensureDb();
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    return membership;
  }

  private async requireWorkspaceAdmin(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.requireWorkspaceMember(workspaceId, userId);
    if (
      membership.role !== WorkspaceRole.OWNER &&
      membership.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException('Workspace admin required');
    }
  }

  async requireTeamMember(
    teamId: string,
    userId: string,
  ): Promise<{ role: TeamRole; workspaceId: string }> {
    this.ensureDb();
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: { team: { select: { workspaceId: true } } },
    });
    if (!membership) {
      const team = await this.prisma.team.findUnique({ where: { id: teamId } });
      if (!team) {
        throw new NotFoundException(`Team ${teamId} not found`);
      }
      const ws = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: team.workspaceId, userId },
        },
      });
      if (
        ws &&
        (ws.role === WorkspaceRole.OWNER || ws.role === WorkspaceRole.ADMIN)
      ) {
        return { role: TeamRole.ADMIN, workspaceId: team.workspaceId };
      }
      throw new ForbiddenException('Not a member of this team');
    }
    return {
      role: membership.role,
      workspaceId: membership.team.workspaceId,
    };
  }

  async requireTeamAdmin(teamId: string, userId: string): Promise<void> {
    const membership = await this.requireTeamMember(teamId, userId);
    if (membership.role !== TeamRole.ADMIN) {
      throw new ForbiddenException('Team admin required');
    }
  }

  private asPlanKey(raw: string | null | undefined): PlanKey {
    if (raw === PLAN_KEYS.team) {
      return PLAN_KEYS.team;
    }
    return PLAN_KEYS.free;
  }

  private async limitsForWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { planKey: true },
    });
    return getVibestandupLimits(this.asPlanKey(workspace?.planKey));
  }

  private async assertCanAddTeam(workspaceId: string): Promise<void> {
    const limits = await this.limitsForWorkspace(workspaceId);
    const count = await this.prisma.team.count({ where: { workspaceId } });
    if (count >= limits.maxTeams) {
      throw new BadRequestException(
        `Plan limit reached: max ${limits.maxTeams} team(s) for VibeStandup`,
      );
    }
  }

  private async assertCanAddMember(teamId: string): Promise<void> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { workspaceId: true },
    });
    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }
    const limits = await this.limitsForWorkspace(team.workspaceId);
    const [memberCount, pendingCount] = await Promise.all([
      this.prisma.teamMember.count({ where: { teamId } }),
      this.prisma.teamInvite.count({
        where: { teamId, status: TeamInviteStatus.PENDING },
      }),
    ]);
    if (memberCount + pendingCount >= limits.maxMembersPerTeam) {
      throw new BadRequestException(
        `Plan limit reached: max ${limits.maxMembersPerTeam} members per team`,
      );
    }
  }

  private async ensureWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: {
        workspaceId,
        userId,
        role: WorkspaceRole.MEMBER,
      },
      update: {},
    });
  }

  private async upsertTeamMember(
    teamId: string,
    userId: string,
    role: TeamRole,
  ) {
    return this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: { teamId, userId, role },
      update: { role },
      include: { user: true },
    });
  }

  async listMine(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<MyTeamDto[]> {
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceMember(workspaceId, userId);

    const memberships = await this.prisma.teamMember.findMany({
      where: { userId, team: { workspaceId } },
      include: { team: true },
      orderBy: { createdAt: 'asc' },
    });

    const ws = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (
      ws &&
      (ws.role === WorkspaceRole.OWNER || ws.role === WorkspaceRole.ADMIN)
    ) {
      const all = await this.prisma.team.findMany({
        where: { workspaceId },
        orderBy: { name: 'asc' },
      });
      const byId = new Map(
        memberships.map((m) => [
          m.teamId,
          {
            id: m.team.id,
            name: m.team.name,
            slug: m.team.slug,
            role: m.role as 'ADMIN' | 'MEMBER',
          },
        ]),
      );
      return all.map(
        (t) =>
          byId.get(t.id) ?? {
            id: t.id,
            name: t.name,
            slug: t.slug,
            role: 'ADMIN' as const,
          },
      );
    }

    return memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      slug: m.team.slug,
      role: m.role,
    }));
  }

  async create(
    workspaceId: string,
    user: VerifiedUser,
    name: string,
    slug: string,
  ): Promise<TeamDto> {
    const userId = await this.resolveUserId(user);
    await this.requireWorkspaceAdmin(workspaceId, userId);
    await this.assertCanAddTeam(workspaceId);

    try {
      const team = await this.prisma.team.create({
        data: {
          workspaceId,
          name,
          slug,
          members: {
            create: { userId, role: TeamRole.ADMIN },
          },
          standupConfig: {
            create: {},
          },
        },
      });
      return { id: team.id, name: team.name, slug: team.slug };
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          `Team slug "${slug}" is already used in this workspace`,
        );
      }
      throw err;
    }
  }

  async listMembers(
    teamId: string,
    user: VerifiedUser,
  ): Promise<TeamMemberDto[]> {
    const userId = await this.resolveUserId(user);
    await this.requireTeamMember(teamId, userId);

    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => this.toMemberDto(m));
  }

  async invite(
    teamId: string,
    user: VerifiedUser,
    targetUserId: string,
    role: TeamRole = TeamRole.MEMBER,
  ): Promise<TeamMemberDto> {
    const userId = await this.resolveUserId(user);
    await this.requireTeamAdmin(teamId, userId);

    const target = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: targetUserId }, { firebaseUid: targetUserId }],
      },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: target.id } },
    });
    if (!existing) {
      await this.assertCanAddMember(teamId);
    }

    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
    });
    await this.ensureWorkspaceMember(team.workspaceId, target.id);
    const member = await this.upsertTeamMember(teamId, target.id, role);
    return this.toMemberDto(member);
  }

  async createInviteByEmail(
    teamId: string,
    user: VerifiedUser,
    emailRaw: string,
    role: TeamRole = TeamRole.MEMBER,
  ): Promise<TeamInviteDto> {
    const userId = await this.resolveUserId(user);
    await this.requireTeamAdmin(teamId, userId);
    const email = this.normalizeEmail(emailRaw);

    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (existingUser) {
      const alreadyMember = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: existingUser.id } },
      });
      if (!alreadyMember) {
        await this.assertCanAddMember(teamId);
      }
      await this.ensureWorkspaceMember(team.workspaceId, existingUser.id);
      const member = await this.upsertTeamMember(teamId, existingUser.id, role);
      const accepted = await this.prisma.teamInvite.create({
        data: {
          teamId,
          email,
          role,
          token: randomBytes(24).toString('hex'),
          status: TeamInviteStatus.ACCEPTED,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
          invitedById: userId,
        },
      });
      return {
        ...this.toInviteDto(accepted),
        member: this.toMemberDto(member),
      };
    }

    const pending = await this.prisma.teamInvite.findFirst({
      where: { teamId, email, status: TeamInviteStatus.PENDING },
    });
    if (pending) {
      if (pending.expiresAt > new Date()) {
        const mail = await this.sendInviteEmail(pending, team.name);
        return this.toInviteDto(pending, mail);
      }
      await this.prisma.teamInvite.update({
        where: { id: pending.id },
        data: { status: TeamInviteStatus.REVOKED },
      });
    }

    await this.assertCanAddMember(teamId);

    const created = await this.prisma.teamInvite.create({
      data: {
        teamId,
        email,
        role,
        token: randomBytes(24).toString('hex'),
        status: TeamInviteStatus.PENDING,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        invitedById: userId,
      },
    });
    const mail = await this.sendInviteEmail(created, team.name);
    return this.toInviteDto(created, mail);
  }

  async listInvites(
    teamId: string,
    user: VerifiedUser,
  ): Promise<TeamInviteDto[]> {
    const userId = await this.resolveUserId(user);
    await this.requireTeamAdmin(teamId, userId);

    const rows = await this.prisma.teamInvite.findMany({
      where: { teamId, status: TeamInviteStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toInviteDto(r));
  }

  async revokeInvite(
    teamId: string,
    inviteId: string,
    user: VerifiedUser,
  ): Promise<TeamInviteDto> {
    const userId = await this.resolveUserId(user);
    await this.requireTeamAdmin(teamId, userId);

    const invite = await this.prisma.teamInvite.findFirst({
      where: { id: inviteId, teamId },
    });
    if (!invite) {
      throw new NotFoundException(`Invite ${inviteId} not found`);
    }
    if (invite.status !== TeamInviteStatus.PENDING) {
      throw new BadRequestException('Only pending invites can be revoked');
    }
    const updated = await this.prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: TeamInviteStatus.REVOKED },
    });
    return this.toInviteDto(updated);
  }

  async acceptInvite(
    token: string,
    user: VerifiedUser,
  ): Promise<AcceptTeamInviteDto> {
    const userId = await this.resolveUserId(user);
    this.ensureDb();

    const invite = await this.prisma.teamInvite.findUnique({
      where: { token },
      include: { team: true },
    });
    if (!invite || invite.status !== TeamInviteStatus.PENDING) {
      throw new NotFoundException('Invite not found or no longer pending');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      await this.prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: TeamInviteStatus.REVOKED },
      });
      throw new BadRequestException('Invite has expired');
    }

    const record = await this.users.upsertFromFirebase(user);
    const userEmail = record.email ? this.normalizeEmail(record.email) : null;
    if (!userEmail || userEmail !== invite.email) {
      throw new ForbiddenException(
        'Signed-in email must match the invitation email',
      );
    }

    await this.ensureWorkspaceMember(invite.team.workspaceId, userId);
    const member = await this.upsertTeamMember(
      invite.teamId,
      userId,
      invite.role,
    );
    await this.prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: TeamInviteStatus.ACCEPTED },
    });

    return {
      teamId: invite.teamId,
      workspaceId: invite.team.workspaceId,
      member: this.toMemberDto(member),
    };
  }
}
