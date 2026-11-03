import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { MeWorkspaceDto } from './me-workspace.dto';

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
}
