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
  LinearConnectionDto,
  LinearOAuthStartDto,
  LinearProjectDto,
  SelectLinearProjectDto,
  SetTeamLinearProjectDto,
  TeamLinearProjectDto,
} from './linear.dto';
import { LinearService } from './linear.service';

@ApiTags('linear')
@Controller()
export class LinearController {
  constructor(private readonly linear: LinearService) {}

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

  @Get('addons/linear/status')
  @ApiOperation({ summary: 'Linear add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.linear.status();
  }

  @Get('workspaces/:workspaceId/addons/linear')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Linear connection for a workspace (secret never returned)',
  })
  @ApiOkResponse({ type: LinearConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getConnection(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<LinearConnectionDto> {
    return this.linear.getConnection(workspaceId, user);
  }

  @Get('workspaces/:workspaceId/addons/linear/oauth/start')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start Linear OAuth; returns authorize URL for the browser',
  })
  @ApiOkResponse({ type: LinearOAuthStartDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  startOAuth(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<LinearOAuthStartDto> {
    return this.linear.startOAuth(workspaceId, user);
  }

  @Get('addons/linear/oauth/callback')
  @ApiOperation({
    summary:
      'Linear OAuth callback (public); redirects to standup workspace admin',
  })
  @Redirect()
  async oauthCallback(
    @Query('code') code?: string | string[],
    @Query('state') state?: string | string[],
    @Query('error') error?: string | string[],
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.linear.completeOAuthCallback(
      this.singleQuery(code),
      this.singleQuery(state),
      this.singleQuery(error),
    );
    return { url, statusCode: 302 };
  }

  @Get('workspaces/:workspaceId/addons/linear/projects')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List Linear projects for digest target picker' })
  @ApiOkResponse({ type: LinearProjectDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listProjects(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<LinearProjectDto[]> {
    return this.linear.listProjects(workspaceId, user);
  }

  @Put('workspaces/:workspaceId/addons/linear/project')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Select Linear project for standup digests' })
  @ApiOkResponse({ type: LinearConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  selectProject(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: SelectLinearProjectDto,
  ): Promise<LinearConnectionDto> {
    return this.linear.selectProject(workspaceId, user, body);
  }

  @Delete('workspaces/:workspaceId/addons/linear')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Linear (clears OAuth tokens)' })
  @ApiOkResponse({ type: LinearConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  disconnect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<LinearConnectionDto> {
    return this.linear.disconnect(workspaceId, user);
  }

  @Get('teams/:teamId/addons/linear/projects')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List Linear projects for per-team digest picker' })
  @ApiOkResponse({ type: LinearProjectDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listProjectsForTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<LinearProjectDto[]> {
    return this.linear.listProjectsForTeam(teamId, user);
  }

  @Get('teams/:teamId/addons/linear/project')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get effective Linear digest project for a team' })
  @ApiOkResponse({ type: TeamLinearProjectDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getTeamProject(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamLinearProjectDto> {
    return this.linear.getTeamProject(teamId, user);
  }

  @Put('teams/:teamId/addons/linear/project')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set Linear project override for a team' })
  @ApiOkResponse({ type: TeamLinearProjectDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  setTeamProject(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: SetTeamLinearProjectDto,
  ): Promise<TeamLinearProjectDto> {
    return this.linear.setTeamProject(teamId, user, body);
  }

  @Delete('teams/:teamId/addons/linear/project')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Clear team Linear project override (use workspace default)',
  })
  @ApiOkResponse({ type: TeamLinearProjectDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  clearTeamProject(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamLinearProjectDto> {
    return this.linear.clearTeamProject(teamId, user);
  }
}
