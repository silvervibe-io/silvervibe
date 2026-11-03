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
import { UsersService } from '../users/users.service';
import { CreateWorkspaceDto } from './create-workspace.dto';
import { SetToolEntitlementDto } from './set-tool-entitlement.dto';
import { SetWorkspacePlanDto } from './set-workspace-plan.dto';
import { WorkspaceDto } from './workspace.dto';
import { WorkspaceToolDto } from './workspace-tool.dto';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly users: UsersService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a workspace',
    description:
      'Creates a workspace, adds the caller as OWNER, and enables vibestandup by default.',
  })
  @ApiOkResponse({ type: WorkspaceDto })
  @ApiUnauthorizedResponse()
  async create(
    @Body() body: CreateWorkspaceDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<WorkspaceDto> {
    const record = await this.users.upsertFromFirebase(user);
    const workspace = await this.workspaces.create(
      body.name,
      body.slug,
      record.id === 'local' ? undefined : record.id,
    );
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      planKey: (workspace.planKey === 'team' ? 'team' : 'free') as
        | 'free'
        | 'team',
    };
  }

  @Put(':workspaceId/plan')
  @ApiOperation({
    summary: 'Set workspace commercial plan',
    description:
      'Pre-billing unlock: OWNER may set `free` or `team`. Nest enforces VibeStandup team/member limits from `plans.catalog` for the stored planKey. Not Stripe billing.',
  })
  @ApiOkResponse({ type: WorkspaceDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async setPlan(
    @Param('workspaceId') workspaceId: string,
    @Body() body: SetWorkspacePlanDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<WorkspaceDto> {
    return this.workspaces.setPlan(workspaceId, body.planKey, user);
  }

  @Get(':workspaceId/tools')
  @ApiOperation({
    summary: 'List workspace tool entitlements',
    description:
      'Ownership rows from `workspace_tools` (not GrowthBook rollout flags). Requires workspace membership.',
  })
  @ApiOkResponse({ type: WorkspaceToolDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async listTools(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: VerifiedUser,
  ): Promise<WorkspaceToolDto[]> {
    return this.workspaces.listTools(workspaceId, user);
  }

  @Put(':workspaceId/tools/:toolKey')
  @ApiOperation({
    summary: 'Grant or revoke a tool entitlement',
    description:
      '`enabled: true` grants (upserts); `enabled: false` revokes. `toolKey` must be a known TOOL_KEYS value. Requires workspace OWNER or ADMIN.',
  })
  @ApiOkResponse({ type: WorkspaceToolDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async setTool(
    @Param('workspaceId') workspaceId: string,
    @Param('toolKey') toolKey: string,
    @Body() body: SetToolEntitlementDto,
    @CurrentUser() user: VerifiedUser,
  ): Promise<WorkspaceToolDto> {
    return this.workspaces.setToolEntitlement(
      workspaceId,
      toolKey,
      body.enabled,
      user,
    );
  }
}
