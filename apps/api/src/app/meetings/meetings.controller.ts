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
  CloseMeetingDto,
  CreateMeetingDto,
  MeetingDetailDto,
  MeetingMemberDto,
  MeetingSummaryDto,
  SetMeetingActionsDto,
  SetMeetingDecisionsDto,
  SetMeetingInvitesDto,
  UpdateMeetingSettingsDto,
} from './meetings.dto';
import { MeetingsService } from './meetings.service';

@ApiTags('meetings')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller()
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get('workspaces/:workspaceId/meeting-members')
  @ApiOperation({ summary: 'List workspace members (for meeting invites)' })
  @ApiOkResponse({ type: MeetingMemberDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listMembers(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<MeetingMemberDto[]> {
    return this.meetings.listWorkspaceMembers(workspaceId, user);
  }

  @Post('workspaces/:workspaceId/meetings')
  @ApiOperation({ summary: 'Create a workspace meeting' })
  @ApiOkResponse({ type: MeetingDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateMeetingDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<MeetingDetailDto> {
    return this.meetings.create(workspaceId, user, body);
  }

  @Get('workspaces/:workspaceId/meetings')
  @ApiOperation({ summary: 'List meetings for the caller in a workspace' })
  @ApiOkResponse({ type: MeetingSummaryDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  list(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<MeetingSummaryDto[]> {
    return this.meetings.list(workspaceId, user);
  }

  @Get('meetings/:meetingId')
  @ApiOperation({ summary: 'Get meeting detail' })
  @ApiOkResponse({ type: MeetingDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  get(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<MeetingDetailDto> {
    return this.meetings.get(meetingId, user);
  }

  @Patch('meetings/:meetingId/settings')
  @ApiOperation({
    summary:
      'Update title, context, agenda, policies, or schedule while not closed',
  })
  @ApiOkResponse({ type: MeetingDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  updateSettings(
    @Param('meetingId') meetingId: string,
    @Body() body: UpdateMeetingSettingsDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<MeetingDetailDto> {
    return this.meetings.updateSettings(meetingId, user, body);
  }

  @Put('meetings/:meetingId/invites')
  @ApiOperation({ summary: 'Replace in-app meeting invites' })
  @ApiOkResponse({ type: MeetingDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  setInvites(
    @Param('meetingId') meetingId: string,
    @Body() body: SetMeetingInvitesDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<MeetingDetailDto> {
    return this.meetings.setInvites(meetingId, user, body);
  }

  @Put('meetings/:meetingId/decisions')
  @ApiOperation({ summary: 'Replace meeting decisions while open' })
  @ApiOkResponse({ type: MeetingDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  setDecisions(
    @Param('meetingId') meetingId: string,
    @Body() body: SetMeetingDecisionsDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<MeetingDetailDto> {
    return this.meetings.setDecisions(meetingId, user, body);
  }

  @Put('meetings/:meetingId/actions')
  @ApiOperation({ summary: 'Replace meeting action items while open' })
  @ApiOkResponse({ type: MeetingDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  setActions(
    @Param('meetingId') meetingId: string,
    @Body() body: SetMeetingActionsDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<MeetingDetailDto> {
    return this.meetings.setActions(meetingId, user, body);
  }

  @Post('meetings/:meetingId/close')
  @ApiOperation({ summary: 'Close a meeting with optional recap' })
  @ApiOkResponse({ type: MeetingDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  close(
    @Param('meetingId') meetingId: string,
    @Body() body: CloseMeetingDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<MeetingDetailDto> {
    return this.meetings.close(meetingId, user, body);
  }
}
