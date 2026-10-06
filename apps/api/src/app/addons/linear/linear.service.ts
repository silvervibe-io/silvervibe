import { Injectable } from '@nestjs/common';
import { AddonStatusDto } from '../addon-status.dto';

@Injectable()
export class LinearService {
  status(): AddonStatusDto {
    return { name: 'linear', status: 'ready' };
  }
}
