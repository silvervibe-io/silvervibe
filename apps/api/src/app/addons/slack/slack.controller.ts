import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddonStatusDto } from '../addon-status.dto';
import { SlackService } from './slack.service';

@ApiTags('slack')
@Controller('addons/slack')
export class SlackController {
  constructor(private readonly slack: SlackService) {}

  @Get('status')
  @ApiOperation({ summary: 'Slack add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.slack.status();
  }
}
