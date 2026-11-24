import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { VerifiedUser } from '../auth/firebase-auth.service';
import {
  CastVoteDto,
  CreatePollDto,
  PollDetailDto,
  PollResultsDto,
  PollSummaryDto,
  SetPollInvitesDto,
  WorkspaceMemberDto,
} from './poll.dto';
import { PollsService } from './polls.service';

@ApiTags('polls')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller()
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Get('workspaces/:workspaceId/members')
  @ApiOperation({ summary: 'List workspace members (for poll invites)' })
  @ApiOkResponse({ type: WorkspaceMemberDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listMembers(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<WorkspaceMemberDto[]> {
    return this.polls.listWorkspaceMembers(workspaceId, user);
  }

  @Post('workspaces/:workspaceId/polls')
  @ApiOperation({ summary: 'Create a workspace poll' })
  @ApiOkResponse({ type: PollDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreatePollDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<PollDetailDto> {
    return this.polls.create(workspaceId, user, body);
  }

  @Get('workspaces/:workspaceId/polls')
  @ApiOperation({ summary: 'List polls for the caller in a workspace' })
  @ApiOkResponse({ type: PollSummaryDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  list(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<PollSummaryDto[]> {
    return this.polls.list(workspaceId, user);
  }

  @Get('polls/:pollId')
  @ApiOperation({ summary: 'Get poll detail' })
  @ApiOkResponse({ type: PollDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  get(
    @Param('pollId') pollId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<PollDetailDto> {
    return this.polls.get(pollId, user);
  }

  @Post('polls/:pollId/close')
  @ApiOperation({ summary: 'Close a poll' })
  @ApiOkResponse({ type: PollDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  close(
    @Param('pollId') pollId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<PollDetailDto> {
    return this.polls.close(pollId, user);
  }

  @Put('polls/:pollId/invites')
  @ApiOperation({ summary: 'Replace in-app poll invites' })
  @ApiOkResponse({ type: PollDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  setInvites(
    @Param('pollId') pollId: string,
    @Body() body: SetPollInvitesDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<PollDetailDto> {
    return this.polls.setInvites(pollId, user, body);
  }

  @Post('polls/:pollId/vote')
  @ApiOperation({ summary: 'Cast or change a vote' })
  @ApiOkResponse({ type: PollDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  vote(
    @Param('pollId') pollId: string,
    @Body() body: CastVoteDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<PollDetailDto> {
    return this.polls.vote(pollId, user, body);
  }

  @Get('polls/:pollId/results')
  @ApiOperation({ summary: 'Get poll tallies' })
  @ApiOkResponse({ type: PollResultsDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  results(
    @Param('pollId') pollId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<PollResultsDto> {
    return this.polls.results(pollId, user);
  }
}
