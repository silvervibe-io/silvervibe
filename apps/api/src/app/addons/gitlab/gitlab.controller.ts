import {
  Controller,
  Delete,
  Get,
  Param,
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
import { GitlabConnectionDto, GitlabOAuthStartDto } from './gitlab.dto';
import { GitlabService } from './gitlab.service';

@ApiTags('gitlab')
@Controller()
export class GitlabController {
  constructor(private readonly gitlab: GitlabService) {}

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

  @Get('addons/gitlab/status')
  @ApiOperation({ summary: 'GitLab add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.gitlab.status();
  }

  @Get('workspaces/:workspaceId/addons/gitlab')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get GitLab connection for a workspace (secret never returned)',
  })
  @ApiOkResponse({ type: GitlabConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getConnection(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<GitlabConnectionDto> {
    return this.gitlab.getConnection(workspaceId, user);
  }

  @Get('workspaces/:workspaceId/addons/gitlab/oauth/start')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start GitLab OAuth; returns authorize URL for the browser',
  })
  @ApiOkResponse({ type: GitlabOAuthStartDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  startOAuth(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<GitlabOAuthStartDto> {
    return this.gitlab.startOAuth(workspaceId, user);
  }

  @Get('addons/gitlab/oauth/callback')
  @ApiOperation({
    summary:
      'GitLab OAuth callback (public); redirects to standup workspace admin',
  })
  @Redirect()
  async oauthCallback(
    @Query('code') code?: string | string[],
    @Query('state') state?: string | string[],
    @Query('error') error?: string | string[],
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.gitlab.completeOAuthCallback(
      this.singleQuery(code),
      this.singleQuery(state),
      this.singleQuery(error),
    );
    return { url, statusCode: 302 };
  }

  @Delete('workspaces/:workspaceId/addons/gitlab')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect GitLab (clears OAuth token)' })
  @ApiOkResponse({ type: GitlabConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  disconnect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<GitlabConnectionDto> {
    return this.gitlab.disconnect(workspaceId, user);
  }
}
