import { Module } from '@nestjs/common';
import { StandupsModule } from '../standups/standups.module';
import { CronSecretGuard } from './cron-secret.guard';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [StandupsModule],
  controllers: [JobsController],
  providers: [JobsService, CronSecretGuard],
})
export class JobsModule {}
