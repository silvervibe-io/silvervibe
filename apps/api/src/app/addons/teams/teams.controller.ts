import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { CurrentUser } from '../../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../../auth/firebase-auth.guard';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { AddonStatusDto } from '../addon-status.dto';
import { ConnectTeamsDto, TeamsConnectionDto } from './teams.dto';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller()
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get('addons/teams/status')
  @ApiOperation({ summary: 'Microsoft Teams add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.teams.status();
  }

  @Get('workspaces/:workspaceId/addons/teams')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Teams Incoming Webhook connection for a workspace',
  })
  @ApiOkResponse({ type: TeamsConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getConnection(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamsConnectionDto> {
    return this.teams.getConnection(workspaceId, user);
  }

  @Put('workspaces/:workspaceId/addons/teams')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Connect Microsoft Teams via Incoming Webhook (enables addons.teams entitlement)',
  })
  @ApiOkResponse({ type: TeamsConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  connect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
    @Body() body: ConnectTeamsDto,
  ): Promise<TeamsConnectionDto> {
    return this.teams.connect(workspaceId, user, body);
  }

  @Delete('workspaces/:workspaceId/addons/teams')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Teams Incoming Webhook' })
  @ApiOkResponse({ type: TeamsConnectionDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  disconnect(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<TeamsConnectionDto> {
    return this.teams.disconnect(workspaceId, user);
  }
}
