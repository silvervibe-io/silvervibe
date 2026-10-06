import { Injectable } from '@nestjs/common';
import { AddonStatusDto } from '../addon-status.dto';

@Injectable()
export class TeamsService {
  status(): AddonStatusDto {
    return { name: 'teams', status: 'ready' };
  }
}
