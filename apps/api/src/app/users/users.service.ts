import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerifiedUser } from '../auth/firebase-auth.service';

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

  async listEnabledTools(workspaceId: string): Promise<string[]> {
    if (!this.prisma.isEnabled()) {
      return [];
    }
    const tools = await this.prisma.workspaceTool.findMany({
      where: { workspaceId, enabled: true },
      select: { toolKey: true },
    });
    return tools.map((tool) => tool.toolKey);
  }
}
