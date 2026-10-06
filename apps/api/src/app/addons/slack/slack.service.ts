import { Injectable } from '@nestjs/common';
import { AddonStatusDto } from '../addon-status.dto';

@Injectable()
export class SlackService {
  status(): AddonStatusDto {
    return { name: 'slack', status: 'ready' };
  }
}
