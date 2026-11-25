import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
  CloseFeedbackDto,
  CreateFeedbackRequestDto,
  FeedbackDetailDto,
  FeedbackSummaryDto,
  SetFeedbackInvitesDto,
  UpdateFeedbackSettingsDto,
  UpsertFeedbackAnswersDto,
  WorkspaceMemberDto,
} from './feedback.dto';
import { FeedbacksService } from './feedbacks.service';

@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller()
export class FeedbacksController {
  constructor(private readonly feedbacks: FeedbacksService) {}

  @Get('workspaces/:workspaceId/feedback-members')
  @ApiOperation({ summary: 'List workspace members (for feedback invites)' })
  @ApiOkResponse({ type: WorkspaceMemberDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listMembers(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<WorkspaceMemberDto[]> {
    return this.feedbacks.listWorkspaceMembers(workspaceId, user);
  }

  @Post('workspaces/:workspaceId/feedback-requests')
  @ApiOperation({ summary: 'Create a workspace feedback request' })
  @ApiOkResponse({ type: FeedbackDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateFeedbackRequestDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<FeedbackDetailDto> {
    return this.feedbacks.create(workspaceId, user, body);
  }

  @Get('workspaces/:workspaceId/feedback-requests')
  @ApiOperation({
    summary: 'List feedback requests for the caller in a workspace',
  })
  @ApiOkResponse({ type: FeedbackSummaryDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  list(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<FeedbackSummaryDto[]> {
    return this.feedbacks.list(workspaceId, user);
  }

  @Get('feedback-requests/:requestId')
  @ApiOperation({
    summary: 'Get feedback request detail with visibility-filtered answers',
  })
  @ApiOkResponse({ type: FeedbackDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  get(
    @Param('requestId') requestId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<FeedbackDetailDto> {
    return this.feedbacks.get(requestId, user);
  }

  @Patch('feedback-requests/:requestId/settings')
  @ApiOperation({
    summary:
      'Update title, context, prompts, visibility, anonymity, close policy, or end time',
  })
  @ApiOkResponse({ type: FeedbackDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  updateSettings(
    @Param('requestId') requestId: string,
    @Body() body: UpdateFeedbackSettingsDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<FeedbackDetailDto> {
    return this.feedbacks.updateSettings(requestId, user, body);
  }

  @Put('feedback-requests/:requestId/invites')
  @ApiOperation({ summary: 'Replace in-app feedback invites' })
  @ApiOkResponse({ type: FeedbackDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  setInvites(
    @Param('requestId') requestId: string,
    @Body() body: SetFeedbackInvitesDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<FeedbackDetailDto> {
    return this.feedbacks.setInvites(requestId, user, body);
  }

  @Put('feedback-requests/:requestId/answers')
  @ApiOperation({ summary: 'Upsert own answers for prompts' })
  @ApiOkResponse({ type: FeedbackDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  upsertAnswers(
    @Param('requestId') requestId: string,
    @Body() body: UpsertFeedbackAnswersDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<FeedbackDetailDto> {
    return this.feedbacks.upsertAnswers(requestId, user, body);
  }

  @Post('feedback-requests/:requestId/close')
  @ApiOperation({ summary: 'Close a feedback request with optional summary' })
  @ApiOkResponse({ type: FeedbackDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  close(
    @Param('requestId') requestId: string,
    @Body() body: CloseFeedbackDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<FeedbackDetailDto> {
    return this.feedbacks.close(requestId, user, body);
  }
}
