import { Injectable } from '@nestjs/common';
import { HealthDto } from './health.dto';

@Injectable()
export class AppService {
  health(): HealthDto {
    return { status: 'ok' };
  }
}
