import { Module } from '@nestjs/common';
import { CronSecretGuard } from './cron-secret.guard';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, CronSecretGuard],
})
export class JobsModule {}
