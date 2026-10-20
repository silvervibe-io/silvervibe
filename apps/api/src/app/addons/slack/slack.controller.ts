import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../../auth/firebase-auth.guard';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { AddonStatusDto } from '../addon-status.dto';
import { ConnectSlackDto, SlackConnectionDto } from './slack.dto';
import { SlackService } from './slack.service';

@ApiTags('slack')
@Controller()
export class SlackController {
  constructor(private readonly slack: SlackService) {}

  @Get('addons/slack/status')
  @ApiOperation({ summary: 'Slack add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.slack.status();
  }

  @Get('workspaces/:workspaceId/addons/slack')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Slack Incoming Webhook connection for a workspace',
  })
  @ApiOkResponse({ type: SlackConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getConnection(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<SlackConnectionDto> {
    return this.slack.getConnection(workspaceId, user);
  }

  @Put('workspaces/:workspaceId/addons/slack')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Connect Slack via Incoming Webhook (enables addons.slack entitlement)',
  })
  @ApiOkResponse({ type: SlackConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  connect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: ConnectSlackDto,
  ): Promise<SlackConnectionDto> {
    return this.slack.connect(workspaceId, user, body);
  }

  @Delete('workspaces/:workspaceId/addons/slack')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Slack Incoming Webhook' })
  @ApiOkResponse({ type: SlackConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  disconnect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<SlackConnectionDto> {
    return this.slack.disconnect(workspaceId, user);
  }
}
