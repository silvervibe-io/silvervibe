import {
  Body,
  Controller,
  Delete,
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
  CloseRetroDto,
  CreateRetroDto,
  RetroDetailDto,
  RetroSummaryDto,
  SetRetroInvitesDto,
  UpdateRetroSettingsDto,
  UpsertRetroNoteDto,
  WorkspaceMemberDto,
} from './retro.dto';
import { RetrosService } from './retros.service';

@ApiTags('retros')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller()
export class RetrosController {
  constructor(private readonly retros: RetrosService) {}

  @Get('workspaces/:workspaceId/retro-members')
  @ApiOperation({ summary: 'List workspace members (for retro invites)' })
  @ApiOkResponse({ type: WorkspaceMemberDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listMembers(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<WorkspaceMemberDto[]> {
    return this.retros.listWorkspaceMembers(workspaceId, user);
  }

  @Post('workspaces/:workspaceId/retros')
  @ApiOperation({ summary: 'Create a workspace retro' })
  @ApiOkResponse({ type: RetroDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateRetroDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<RetroDetailDto> {
    return this.retros.create(workspaceId, user, body);
  }

  @Get('workspaces/:workspaceId/retros')
  @ApiOperation({ summary: 'List retros for the caller in a workspace' })
  @ApiOkResponse({ type: RetroSummaryDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  list(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<RetroSummaryDto[]> {
    return this.retros.list(workspaceId, user);
  }

  @Get('retros/:retroId')
  @ApiOperation({ summary: 'Get retro detail with visibility-filtered notes' })
  @ApiOkResponse({ type: RetroDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  get(
    @Param('retroId') retroId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<RetroDetailDto> {
    return this.retros.get(retroId, user);
  }

  @Patch('retros/:retroId/settings')
  @ApiOperation({ summary: 'Update visibility / close policy / end time' })
  @ApiOkResponse({ type: RetroDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  updateSettings(
    @Param('retroId') retroId: string,
    @Body() body: UpdateRetroSettingsDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<RetroDetailDto> {
    return this.retros.updateSettings(retroId, user, body);
  }

  @Put('retros/:retroId/invites')
  @ApiOperation({ summary: 'Replace in-app retro invites' })
  @ApiOkResponse({ type: RetroDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  setInvites(
    @Param('retroId') retroId: string,
    @Body() body: SetRetroInvitesDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<RetroDetailDto> {
    return this.retros.setInvites(retroId, user, body);
  }

  @Post('retros/:retroId/notes')
  @ApiOperation({ summary: 'Add a note' })
  @ApiOkResponse({ type: RetroDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  addNote(
    @Param('retroId') retroId: string,
    @Body() body: UpsertRetroNoteDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<RetroDetailDto> {
    return this.retros.addNote(retroId, user, body);
  }

  @Put('retros/:retroId/notes/:noteId')
  @ApiOperation({ summary: 'Update own note' })
  @ApiOkResponse({ type: RetroDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  updateNote(
    @Param('retroId') retroId: string,
    @Param('noteId') noteId: string,
    @Body() body: UpsertRetroNoteDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<RetroDetailDto> {
    return this.retros.updateNote(retroId, noteId, user, body);
  }

  @Delete('retros/:retroId/notes/:noteId')
  @ApiOperation({ summary: 'Delete own note' })
  @ApiOkResponse({ type: RetroDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  deleteNote(
    @Param('retroId') retroId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<RetroDetailDto> {
    return this.retros.deleteNote(retroId, noteId, user);
  }

  @Post('retros/:retroId/close')
  @ApiOperation({ summary: 'Close a retro with optional summary' })
  @ApiOkResponse({ type: RetroDetailDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  close(
    @Param('retroId') retroId: string,
    @Body() body: CloseRetroDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<RetroDetailDto> {
    return this.retros.close(retroId, user, body);
  }
}
