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
import { TrelloConnectionDto, TrelloOAuthStartDto } from './trello.dto';
import { TrelloService } from './trello.service';

@ApiTags('trello')
@Controller()
export class TrelloController {
  constructor(private readonly trello: TrelloService) {}

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

  @Get('addons/trello/status')
  @ApiOperation({ summary: 'Trello add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.trello.status();
  }

  @Get('workspaces/:workspaceId/addons/trello')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Trello connection for a workspace (secret never returned)',
  })
  @ApiOkResponse({ type: TrelloConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getConnection(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TrelloConnectionDto> {
    return this.trello.getConnection(workspaceId, user);
  }

  @Get('workspaces/:workspaceId/addons/trello/oauth/start')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start Trello OAuth; returns authorize URL for the browser',
  })
  @ApiOkResponse({ type: TrelloOAuthStartDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  startOAuth(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TrelloOAuthStartDto> {
    return this.trello.startOAuth(workspaceId, user);
  }

  @Get('addons/trello/oauth/callback')
  @ApiOperation({
    summary:
      'Trello OAuth callback (public); redirects to standup workspace admin',
  })
  @Redirect()
  async oauthCallback(
    @Query('code') code?: string | string[],
    @Query('state') state?: string | string[],
    @Query('error') error?: string | string[],
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.trello.completeOAuthCallback(
      this.singleQuery(code),
      this.singleQuery(state),
      this.singleQuery(error),
    );
    return { url, statusCode: 302 };
  }

  @Delete('workspaces/:workspaceId/addons/trello')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Trello (clears OAuth token)' })
  @ApiOkResponse({ type: TrelloConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  disconnect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TrelloConnectionDto> {
    return this.trello.disconnect(workspaceId, user);
  }
}
