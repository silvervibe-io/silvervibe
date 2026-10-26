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
  ConnectTeamsDto,
  SelectTeamsChannelDto,
  TeamsConnectionDto,
  TeamsGraphChannelDto,
  TeamsGraphTeamDto,
  TeamsOAuthStartDto,
} from './teams.dto';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller()
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

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

  @Get('addons/teams/status')
  @ApiOperation({ summary: 'Microsoft Teams add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.teams.status();
  }

  @Get('workspaces/:workspaceId/addons/teams')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Teams connection for a workspace (secret never returned)',
  })
  @ApiOkResponse({ type: TeamsConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getConnection(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamsConnectionDto> {
    return this.teams.getConnection(workspaceId, user);
  }

  @Get('workspaces/:workspaceId/addons/teams/oauth/start')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start Teams OAuth; returns Microsoft Entra authorize URL',
  })
  @ApiOkResponse({ type: TeamsOAuthStartDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  startOAuth(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamsOAuthStartDto> {
    return this.teams.startOAuth(workspaceId, user);
  }

  @Get('addons/teams/oauth/callback')
  @ApiOperation({
    summary:
      'Teams OAuth callback (public); redirects to standup workspace admin',
  })
  @Redirect()
  async oauthCallback(
    @Query('code') code?: string | string[],
    @Query('state') state?: string | string[],
    @Query('error') error?: string | string[],
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.teams.completeOAuthCallback(
      this.singleQuery(code),
      this.singleQuery(state),
      this.singleQuery(error),
    );
    return { url, statusCode: 302 };
  }

  @Get('workspaces/:workspaceId/addons/teams/joined-teams')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List Microsoft Teams the connecting user joined' })
  @ApiOkResponse({ type: TeamsGraphTeamDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listJoinedTeams(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamsGraphTeamDto[]> {
    return this.teams.listJoinedTeams(workspaceId, user);
  }

  @Get('workspaces/:workspaceId/addons/teams/channels')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List channels for a Microsoft Team' })
  @ApiOkResponse({ type: TeamsGraphChannelDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listChannels(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
    @Query('teamId') teamId: string | string[],
  ): Promise<TeamsGraphChannelDto[]> {
    const id = this.singleQuery(teamId);
    return this.teams.listChannels(workspaceId, user, id ?? '');
  }

  @Put('workspaces/:workspaceId/addons/teams/channel')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Select the Teams team/channel for standup digests (OAuth installs)',
  })
  @ApiOkResponse({ type: TeamsConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  selectChannel(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: SelectTeamsChannelDto,
  ): Promise<TeamsConnectionDto> {
    return this.teams.selectChannel(workspaceId, user, body);
  }

  @Put('workspaces/:workspaceId/addons/teams')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Deprecated: connect Teams via Incoming Webhook. Prefer OAuth start.',
    deprecated: true,
  })
  @ApiOkResponse({ type: TeamsConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  connect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: ConnectTeamsDto,
  ): Promise<TeamsConnectionDto> {
    return this.teams.connect(workspaceId, user, body);
  }

  @Delete('workspaces/:workspaceId/addons/teams')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Teams (clears tokens / webhook)' })
  @ApiOkResponse({ type: TeamsConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  disconnect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamsConnectionDto> {
    return this.teams.disconnect(workspaceId, user);
  }
}
