import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
import { TeamRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { VerifiedUser } from '../auth/firebase-auth.service';
import {
  AcceptTeamInviteDto,
  CreateTeamDto,
  CreateTeamInviteDto,
  InviteTeamMemberDto,
  MyTeamDto,
  TeamDto,
  TeamInviteDto,
  TeamMemberDto,
} from './team.dto';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller()
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get('workspaces/:workspaceId/teams/mine')
  @ApiOperation({ summary: 'Teams the current user can access in a workspace' })
  @ApiOkResponse({ type: MyTeamDto, isArray: true })
  @ApiUnauthorizedResponse()
  listMine(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<MyTeamDto[]> {
    return this.teams.listMine(workspaceId, user);
  }

  @Post('workspaces/:workspaceId/teams')
  @ApiOperation({ summary: 'Create a team (workspace admin)' })
  @ApiOkResponse({ type: TeamDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: CreateTeamDto,
  ): Promise<TeamDto> {
    return this.teams.create(workspaceId, user, body.name, body.slug);
  }

  @Get('teams/:teamId/members')
  @ApiOperation({ summary: 'List team members' })
  @ApiOkResponse({ type: TeamMemberDto, isArray: true })
  @ApiUnauthorizedResponse()
  listMembers(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamMemberDto[]> {
    return this.teams.listMembers(teamId, user);
  }

  @Post('teams/:teamId/members')
  @ApiOperation({
    summary: 'Add an existing user to a team by Neon id or Firebase UID',
  })
  @ApiOkResponse({ type: TeamMemberDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  invite(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: InviteTeamMemberDto,
  ): Promise<TeamMemberDto> {
    return this.teams.invite(
      teamId,
      user,
      body.userId,
      (body.role as TeamRole | undefined) ?? TeamRole.MEMBER,
    );
  }

  @Post('teams/:teamId/invites')
  @ApiOperation({
    summary: 'Invite a member by email (pending link or immediate add)',
    description:
      'If the email already belongs to a Neon user, adds WorkspaceMember + TeamMember immediately. Otherwise creates a pending invite with a shareable accept path.',
  })
  @ApiOkResponse({ type: TeamInviteDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  createInvite(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: CreateTeamInviteDto,
  ): Promise<TeamInviteDto> {
    return this.teams.createInviteByEmail(
      teamId,
      user,
      body.email,
      (body.role as TeamRole | undefined) ?? TeamRole.MEMBER,
    );
  }

  @Get('teams/:teamId/invites')
  @ApiOperation({ summary: 'List pending team invites (team admin)' })
  @ApiOkResponse({ type: TeamInviteDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listInvites(
    @Param('teamId') teamId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamInviteDto[]> {
    return this.teams.listInvites(teamId, user);
  }

  @Delete('teams/:teamId/invites/:inviteId')
  @ApiOperation({ summary: 'Revoke a pending team invite' })
  @ApiOkResponse({ type: TeamInviteDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  revokeInvite(
    @Param('teamId') teamId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamInviteDto> {
    return this.teams.revokeInvite(teamId, inviteId, user);
  }

  @Post('invites/:token/accept')
  @ApiOperation({
    summary: 'Accept a pending team invite by token',
    description:
      'Caller must be signed in with the same email as the invite. Adds workspace + team membership.',
  })
  @ApiOkResponse({ type: AcceptTeamInviteDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  acceptInvite(
    @Param('token') token: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<AcceptTeamInviteDto> {
    return this.teams.acceptInvite(token, user);
  }
}
