import { Injectable } from '@nestjs/common';
import { AddonStatusDto } from '../addon-status.dto';

@Injectable()
export class GithubService {
  status(): AddonStatusDto {
    return { name: 'github', status: 'ready' };
  }
}
