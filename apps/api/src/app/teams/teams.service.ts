import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TeamRole, WorkspaceRole } from '@prisma/client';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MyTeamDto, TeamDto, TeamMemberDto } from './team.dto';

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
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
      // Workspace admins can act on any team in the workspace
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

    // Workspace admins also see teams they are not members of
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

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      email: m.user.email,
      displayName: m.user.displayName,
    }));
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

    const member = await this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: target.id } },
      create: { teamId, userId: target.id, role },
      update: { role },
      include: { user: true },
    });

    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      email: member.user.email,
      displayName: member.user.displayName,
    };
  }
}
