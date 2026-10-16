import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
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
  CreateTeamDto,
  InviteTeamMemberDto,
  MyTeamDto,
  TeamDto,
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
  @ApiOperation({ summary: 'Invite or update a team member (team admin)' })
  @ApiOkResponse({ type: TeamMemberDto })
  @ApiUnauthorizedResponse()
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
}
