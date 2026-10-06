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
      };
    }

    return this.prisma.user.upsert({
      where: { firebaseUid: user.uid },
      create: {
        firebaseUid: user.uid,
        email: user.email,
      },
      update: {
        email: user.email,
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
