import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Nest wrapper around Prisma. Connects when DATABASE_URL is set; otherwise
 * stays offline so local smoke tests can run without Neon.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly enabled = Boolean(process.env['DATABASE_URL']);

  constructor() {
    super({
      datasources: {
        db: {
          url:
            process.env['DATABASE_URL'] ??
            'postgresql://localhost:5432/silvervibe',
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    await this.$disconnect();
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
