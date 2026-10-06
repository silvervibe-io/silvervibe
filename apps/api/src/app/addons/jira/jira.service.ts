import { Injectable } from '@nestjs/common';
import { AddonStatusDto } from '../addon-status.dto';

@Injectable()
export class JiraService {
  status(): AddonStatusDto {
    return { name: 'jira', status: 'ready' };
  }
}
