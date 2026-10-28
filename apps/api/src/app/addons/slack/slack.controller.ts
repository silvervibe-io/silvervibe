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
  SetTeamSlackChannelDto,
  SlackChannelsDto,
  SlackConnectionDto,
  SlackOAuthStartDto,
  TeamSlackChannelDto,
} from './slack.dto';
import { SlackService } from './slack.service';

@ApiTags('slack')
@Controller()
export class SlackController {
  constructor(private readonly slack: SlackService) {}

  /** Nest may pass repeated query keys as string[]. */
  private singleQuery(
    value: string | string[] | undefined,
  ): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }
    return undefined;
  }

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
    @Query('code') code?: string | string[],
    @Query('state') state?: string | string[],
    @Query('error') error?: string | string[],
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.slack.completeOAuthCallback(
      this.singleQuery(code),
      this.singleQuery(state),
      this.singleQuery(error),
    );
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

  @Get('teams/:teamId/addons/slack/channels')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List Slack channels for per-team digest picker' })
  @ApiOkResponse({ type: SlackChannelsDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listChannelsForTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<SlackChannelsDto> {
    return this.slack.listChannelsForTeam(teamId, user);
  }

  @Get('teams/:teamId/addons/slack/channel')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get effective Slack digest channel for a team' })
  @ApiOkResponse({ type: TeamSlackChannelDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getTeamChannel(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamSlackChannelDto> {
    return this.slack.getTeamChannel(teamId, user);
  }

  @Put('teams/:teamId/addons/slack/channel')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set Slack digest channel override for a team' })
  @ApiOkResponse({ type: TeamSlackChannelDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  setTeamChannel(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: SetTeamSlackChannelDto,
  ): Promise<TeamSlackChannelDto> {
    return this.slack.setTeamChannel(teamId, user, body);
  }

  @Delete('teams/:teamId/addons/slack/channel')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Clear team Slack channel override (use workspace default)',
  })
  @ApiOkResponse({ type: TeamSlackChannelDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  clearTeamChannel(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamSlackChannelDto> {
    return this.slack.clearTeamChannel(teamId, user);
  }
}
