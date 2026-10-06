import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddonStatusDto } from '../addon-status.dto';
import { GithubService } from './github.service';

@ApiTags('github')
@Controller('addons/github')
export class GithubController {
  constructor(private readonly github: GithubService) {}

  @Get('status')
  @ApiOperation({ summary: 'GitHub add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.github.status();
  }
}
