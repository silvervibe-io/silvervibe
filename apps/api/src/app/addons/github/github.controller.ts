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
  GithubConnectionDto,
  GithubIssueDto,
  GithubOAuthStartDto,
  GithubRepoDto,
  SelectGithubTargetDto,
  SetTeamGithubTargetDto,
  TeamGithubTargetDto,
} from './github.dto';
import { GithubService } from './github.service';

@ApiTags('github')
@Controller()
export class GithubController {
  constructor(private readonly github: GithubService) {}

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

  @Get('addons/github/status')
  @ApiOperation({ summary: 'GitHub add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.github.status();
  }

  @Get('workspaces/:workspaceId/addons/github')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get GitHub connection for a workspace (secret never returned)',
  })
  @ApiOkResponse({ type: GithubConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getConnection(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<GithubConnectionDto> {
    return this.github.getConnection(workspaceId, user);
  }

  @Get('workspaces/:workspaceId/addons/github/oauth/start')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start GitHub OAuth; returns authorize URL for the browser',
  })
  @ApiOkResponse({ type: GithubOAuthStartDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  startOAuth(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<GithubOAuthStartDto> {
    return this.github.startOAuth(workspaceId, user);
  }

  @Get('addons/github/oauth/callback')
  @ApiOperation({
    summary:
      'GitHub OAuth callback (public); redirects to standup workspace admin',
  })
  @Redirect()
  async oauthCallback(
    @Query('code') code?: string | string[],
    @Query('state') state?: string | string[],
    @Query('error') error?: string | string[],
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.github.completeOAuthCallback(
      this.singleQuery(code),
      this.singleQuery(state),
      this.singleQuery(error),
    );
    return { url, statusCode: 302 };
  }

  @Get('workspaces/:workspaceId/addons/github/repos')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List GitHub repos for digest target picker' })
  @ApiOkResponse({ type: GithubRepoDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listRepos(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<GithubRepoDto[]> {
    return this.github.listRepos(workspaceId, user);
  }

  @Get('workspaces/:workspaceId/addons/github/repos/:owner/:repo/issues')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List open issues in a repo for digest target' })
  @ApiOkResponse({ type: GithubIssueDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listIssues(
    @Param('workspaceId') workspaceId: string,
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<GithubIssueDto[]> {
    return this.github.listIssues(workspaceId, user, owner, repo);
  }

  @Put('workspaces/:workspaceId/addons/github/target')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Select GitHub repo + issue for standup digest comments',
  })
  @ApiOkResponse({ type: GithubConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  selectTarget(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: SelectGithubTargetDto,
  ): Promise<GithubConnectionDto> {
    return this.github.selectTarget(workspaceId, user, body);
  }

  @Delete('workspaces/:workspaceId/addons/github')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect GitHub (clears OAuth token)' })
  @ApiOkResponse({ type: GithubConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  disconnect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<GithubConnectionDto> {
    return this.github.disconnect(workspaceId, user);
  }

  @Get('teams/:teamId/addons/github/repos')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List GitHub repos for per-team digest picker' })
  @ApiOkResponse({ type: GithubRepoDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listReposForTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<GithubRepoDto[]> {
    return this.github.listReposForTeam(teamId, user);
  }

  @Get('teams/:teamId/addons/github/repos/:owner/:repo/issues')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List open issues for per-team GitHub digest picker',
  })
  @ApiOkResponse({ type: GithubIssueDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listIssuesForTeam(
    @Param('teamId') teamId: string,
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<GithubIssueDto[]> {
    return this.github.listIssuesForTeam(teamId, user, owner, repo);
  }

  @Get('teams/:teamId/addons/github/target')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get effective GitHub digest target for a team' })
  @ApiOkResponse({ type: TeamGithubTargetDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getTeamTarget(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamGithubTargetDto> {
    return this.github.getTeamTarget(teamId, user);
  }

  @Put('teams/:teamId/addons/github/target')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set GitHub digest target override for a team' })
  @ApiOkResponse({ type: TeamGithubTargetDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  setTeamTarget(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: SetTeamGithubTargetDto,
  ): Promise<TeamGithubTargetDto> {
    return this.github.setTeamTarget(teamId, user, body);
  }

  @Delete('teams/:teamId/addons/github/target')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Clear team GitHub target override (use workspace default)',
  })
  @ApiOkResponse({ type: TeamGithubTargetDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  clearTeamTarget(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamGithubTargetDto> {
    return this.github.clearTeamTarget(teamId, user);
  }
}
