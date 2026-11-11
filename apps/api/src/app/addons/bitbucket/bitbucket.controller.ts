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
import {
  BitbucketConnectionDto,
  BitbucketOAuthStartDto,
} from './bitbucket.dto';
import { BitbucketService } from './bitbucket.service';

@ApiTags('bitbucket')
@Controller()
export class BitbucketController {
  constructor(private readonly bitbucket: BitbucketService) {}

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

  @Get('addons/bitbucket/status')
  @ApiOperation({ summary: 'Bitbucket add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.bitbucket.status();
  }

  @Get('workspaces/:workspaceId/addons/bitbucket')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Bitbucket connection for a workspace (secret never returned)',
  })
  @ApiOkResponse({ type: BitbucketConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getConnection(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<BitbucketConnectionDto> {
    return this.bitbucket.getConnection(workspaceId, user);
  }

  @Get('workspaces/:workspaceId/addons/bitbucket/oauth/start')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start Bitbucket OAuth; returns authorize URL for the browser',
  })
  @ApiOkResponse({ type: BitbucketOAuthStartDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  startOAuth(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<BitbucketOAuthStartDto> {
    return this.bitbucket.startOAuth(workspaceId, user);
  }

  @Get('addons/bitbucket/oauth/callback')
  @ApiOperation({
    summary:
      'Bitbucket OAuth callback (public); redirects to standup workspace admin',
  })
  @Redirect()
  async oauthCallback(
    @Query('code') code?: string | string[],
    @Query('state') state?: string | string[],
    @Query('error') error?: string | string[],
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.bitbucket.completeOAuthCallback(
      this.singleQuery(code),
      this.singleQuery(state),
      this.singleQuery(error),
    );
    return { url, statusCode: 302 };
  }

  @Delete('workspaces/:workspaceId/addons/bitbucket')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Bitbucket (clears OAuth token)' })
  @ApiOkResponse({ type: BitbucketConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  disconnect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<BitbucketConnectionDto> {
    return this.bitbucket.disconnect(workspaceId, user);
  }
}
