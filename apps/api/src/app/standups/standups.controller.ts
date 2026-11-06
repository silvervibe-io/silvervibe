import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { VerifiedUser } from '../auth/firebase-auth.service';
import {
  MentionIssueDto,
  SetStandupAwayDto,
  StandupAwayDatesDto,
  StandupConfigDto,
  StandupEntryDto,
  StandupRecentDayDto,
  StandupRosterMemberDto,
  StandupSummaryDto,
  UpdateStandupConfigDto,
  UpsertStandupEntryDto,
} from './standup.dto';
import { MentionsService } from './mentions.service';
import { StandupsService } from './standups.service';

@ApiTags('standups')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('teams/:teamId')
export class StandupsController {
  constructor(
    private readonly standups: StandupsService,
    private readonly mentions: MentionsService,
  ) {}

  @Get('standup-config')
  @ApiOperation({ summary: 'Get standup questions/timezone for a team' })
  @ApiOkResponse({ type: StandupConfigDto })
  @ApiUnauthorizedResponse()
  getConfig(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<StandupConfigDto> {
    return this.standups.getConfig(teamId, user);
  }

  @Put('standup-config')
  @ApiOperation({ summary: 'Update standup config (team admin)' })
  @ApiOkResponse({ type: StandupConfigDto })
  @ApiUnauthorizedResponse()
  updateConfig(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: UpdateStandupConfigDto,
  ): Promise<StandupConfigDto> {
    return this.standups.updateConfig(teamId, user, body);
  }

  @Get('standups/me')
  @ApiOperation({ summary: 'Get or create my standup entry for a date' })
  @ApiOkResponse({ type: StandupEntryDto })
  @ApiUnauthorizedResponse()
  getMine(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Query('date') date?: string,
  ): Promise<StandupEntryDto> {
    return this.standups.getMine(teamId, user, date);
  }

  @Put('standups/me')
  @ApiOperation({ summary: 'Save draft or submit my standup' })
  @ApiOkResponse({ type: StandupEntryDto })
  @ApiUnauthorizedResponse()
  upsertMine(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: UpsertStandupEntryDto,
    @Query('date') date?: string,
  ): Promise<StandupEntryDto> {
    return this.standups.upsertMine(teamId, user, body, date);
  }

  @Get('mentions/issues')
  @ApiOperation({
    summary: 'Search issues in connected GitHub, Jira, and Linear accounts',
  })
  @ApiOkResponse({ type: MentionIssueDto, isArray: true })
  @ApiUnauthorizedResponse()
  searchIssues(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Query('q') q = '',
  ): Promise<MentionIssueDto[]> {
    return this.mentions.searchIssues(teamId, user, q);
  }

  @Get('standups/away')
  @ApiOperation({ summary: 'List days this member will not post' })
  @ApiOkResponse({ type: StandupAwayDatesDto })
  listAway(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<StandupAwayDatesDto> {
    return this.standups.listAway(teamId, user);
  }

  @Put('standups/away')
  @ApiOperation({ summary: 'Mark or clear one away day' })
  @ApiOkResponse({ type: StandupAwayDatesDto })
  setAway(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: SetStandupAwayDto,
  ): Promise<StandupAwayDatesDto> {
    return this.standups.setAway(teamId, user, body);
  }

  @Get('standups/roster')
  @ApiOperation({ summary: 'Who posted, who is still open, and who is away' })
  @ApiOkResponse({ type: StandupRosterMemberDto, isArray: true })
  roster(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Query('date') date?: string,
  ): Promise<StandupRosterMemberDto[]> {
    return this.standups.listRoster(teamId, user, date);
  }

  @Get('standups/recent')
  @ApiOperation({ summary: 'Last 14 daily summaries, newest first' })
  @ApiOkResponse({ type: StandupRecentDayDto, isArray: true })
  recent(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<StandupRecentDayDto[]> {
    return this.standups.listRecent(teamId, user);
  }

  @Get('standups')
  @ApiOperation({ summary: 'List team standup entries for a date (admin)' })
  @ApiOkResponse({ type: StandupEntryDto, isArray: true })
  @ApiUnauthorizedResponse()
  list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Query('date') date?: string,
  ): Promise<StandupEntryDto[]> {
    return this.standups.listForTeam(teamId, user, date);
  }

  @Get('standups/summary')
  @ApiOperation({ summary: 'Get daily team summary if present' })
  @ApiOkResponse({ type: StandupSummaryDto })
  @ApiUnauthorizedResponse()
  getSummary(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Query('date') date?: string,
  ): Promise<StandupSummaryDto | null> {
    return this.standups.getSummary(teamId, user, date);
  }

  @Post('standups/summary')
  @ApiOperation({ summary: 'Rebuild daily summary from submitted entries' })
  @ApiOkResponse({ type: StandupSummaryDto })
  @ApiUnauthorizedResponse()
  rebuildSummary(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Query('date') date?: string,
  ): Promise<StandupSummaryDto> {
    return this.standups.rebuildSummary(teamId, user, date);
  }
}
