import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddonStatusDto } from '../addon-status.dto';
import { JiraService } from './jira.service';

@ApiTags('jira')
@Controller('addons/jira')
export class JiraController {
  constructor(private readonly jira: JiraService) {}

  @Get('status')
  @ApiOperation({ summary: 'Jira add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.jira.status();
  }
}
