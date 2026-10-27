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
  JiraConnectionDto,
  JiraIssueDto,
  JiraOAuthStartDto,
  JiraProjectDto,
  JiraSiteDto,
  SelectJiraSiteDto,
  SelectJiraTargetDto,
} from './jira.dto';
import { JiraService } from './jira.service';

@ApiTags('jira')
@Controller()
export class JiraController {
  constructor(private readonly jira: JiraService) {}

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

  @Get('addons/jira/status')
  @ApiOperation({ summary: 'Jira add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.jira.status();
  }

  @Get('workspaces/:workspaceId/addons/jira')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Jira connection for a workspace (secret never returned)',
  })
  @ApiOkResponse({ type: JiraConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getConnection(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<JiraConnectionDto> {
    return this.jira.getConnection(workspaceId, user);
  }

  @Get('workspaces/:workspaceId/addons/jira/oauth/start')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start Jira OAuth (3LO); returns authorize URL for the browser',
  })
  @ApiOkResponse({ type: JiraOAuthStartDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  startOAuth(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<JiraOAuthStartDto> {
    return this.jira.startOAuth(workspaceId, user);
  }

  @Get('addons/jira/oauth/callback')
  @ApiOperation({
    summary:
      'Jira OAuth callback (public); redirects to standup workspace admin',
  })
  @Redirect()
  async oauthCallback(
    @Query('code') code?: string | string[],
    @Query('state') state?: string | string[],
    @Query('error') error?: string | string[],
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.jira.completeOAuthCallback(
      this.singleQuery(code),
      this.singleQuery(state),
      this.singleQuery(error),
    );
    return { url, statusCode: 302 };
  }

  @Get('workspaces/:workspaceId/addons/jira/sites')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List accessible Jira Cloud sites' })
  @ApiOkResponse({ type: JiraSiteDto, isArray: true })
  listSites(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<JiraSiteDto[]> {
    return this.jira.listSites(workspaceId, user);
  }

  @Put('workspaces/:workspaceId/addons/jira/site')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Select Jira Cloud site for digests' })
  @ApiOkResponse({ type: JiraConnectionDto })
  selectSite(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: SelectJiraSiteDto,
  ): Promise<JiraConnectionDto> {
    return this.jira.selectSite(workspaceId, user, body);
  }

  @Get('workspaces/:workspaceId/addons/jira/projects')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List Jira projects on the selected site' })
  @ApiOkResponse({ type: JiraProjectDto, isArray: true })
  listProjects(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<JiraProjectDto[]> {
    return this.jira.listProjects(workspaceId, user);
  }

  @Get('workspaces/:workspaceId/addons/jira/projects/:projectKey/issues')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List recent issues in a Jira project' })
  @ApiOkResponse({ type: JiraIssueDto, isArray: true })
  listIssues(
    @Param('workspaceId') workspaceId: string,
    @Param('projectKey') projectKey: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<JiraIssueDto[]> {
    return this.jira.listIssues(workspaceId, user, projectKey);
  }

  @Put('workspaces/:workspaceId/addons/jira/target')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Select Jira issue for standup digest comments' })
  @ApiOkResponse({ type: JiraConnectionDto })
  selectTarget(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: SelectJiraTargetDto,
  ): Promise<JiraConnectionDto> {
    return this.jira.selectTarget(workspaceId, user, body);
  }

  @Delete('workspaces/:workspaceId/addons/jira')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Jira (clears OAuth tokens)' })
  @ApiOkResponse({ type: JiraConnectionDto })
  disconnect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<JiraConnectionDto> {
    return this.jira.disconnect(workspaceId, user);
  }
}
