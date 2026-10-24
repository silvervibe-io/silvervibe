import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  Redirect,
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
import {
  ConnectSlackDto,
  SlackConnectionDto,
  SlackOAuthStartDto,
} from './slack.dto';
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
    summary: 'Get Slack connection for a workspace (secret never returned)',
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

  @Get('workspaces/:workspaceId/addons/slack/oauth/start')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start Slack OAuth install; returns authorize URL for the browser',
  })
  @ApiOkResponse({ type: SlackOAuthStartDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  startOAuth(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<SlackOAuthStartDto> {
    return this.slack.startOAuth(workspaceId, user);
  }

  @Get('addons/slack/oauth/callback')
  @ApiOperation({
    summary:
      'Slack OAuth callback (public); redirects to standup workspace admin',
  })
  @Redirect()
  async oauthCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.slack.completeOAuthCallback(code, state, error);
    return { url, statusCode: 302 };
  }

  @Put('workspaces/:workspaceId/addons/slack')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Deprecated: connect Slack via Incoming Webhook. Prefer OAuth start.',
    deprecated: true,
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
  @ApiOperation({ summary: 'Disconnect Slack (clears bot token / webhook)' })
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
