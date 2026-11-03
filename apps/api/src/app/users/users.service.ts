import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { isValidTimezone } from '../standups/standup-schedule';
import { MeWorkspaceDto } from './me-workspace.dto';
import { UpdateUserScheduleDto, UserScheduleDto } from './schedule.dto';
import { defaultWeek, parseWeek, weekFromStorage } from './work-hours';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromFirebase(user: VerifiedUser) {
    if (!this.prisma.isEnabled()) {
      return {
        id: 'local',
        firebaseUid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
      };
    }

    return this.prisma.user.upsert({
      where: { firebaseUid: user.uid },
      create: {
        firebaseUid: user.uid,
        email: user.email,
        displayName: user.displayName,
      },
      update: {
        email: user.email,
        displayName: user.displayName,
      },
    });
  }

  async listMyWorkspaces(user: VerifiedUser): Promise<MeWorkspaceDto[]> {
    const record = await this.upsertFromFirebase(user);
    if (!this.prisma.isEnabled() || record.id === 'local') {
      return [];
    }

    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId: record.id },
      include: {
        workspace: {
          include: {
            tools: {
              orderBy: { toolKey: 'asc' },
              select: { toolKey: true, enabled: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      planKey: (m.workspace.planKey === 'team' ? 'team' : 'free') as
        | 'free'
        | 'team',
      role: m.role,
      tools: m.workspace.tools,
    }));
  }

  async getSchedule(user: VerifiedUser): Promise<UserScheduleDto> {
    const record = await this.upsertFromFirebase(user);
    if (!this.prisma.isEnabled() || record.id === 'local') {
      return { timezone: 'UTC', workHours: defaultWeek() };
    }
    const row = await this.prisma.user.findUnique({
      where: { id: record.id },
      select: { timezone: true, workHoursJson: true },
    });
    return {
      timezone: row?.timezone?.trim() || 'UTC',
      workHours: weekFromStorage(row?.workHoursJson),
    };
  }

  async updateSchedule(
    user: VerifiedUser,
    body: UpdateUserScheduleDto,
  ): Promise<UserScheduleDto> {
    const timezone = body.timezone.trim();
    if (!isValidTimezone(timezone)) {
      throw new BadRequestException('schedule.timezone');
    }
    const workHours = parseWeek(body.workHours);
    if (!workHours) {
      throw new BadRequestException('schedule.invalid');
    }
    const record = await this.upsertFromFirebase(user);
    if (!this.prisma.isEnabled() || record.id === 'local') {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for schedules',
      );
    }
    await this.prisma.user.update({
      where: { id: record.id },
      data: { timezone, workHoursJson: workHours },
    });
    return { timezone, workHours };
  }
}
