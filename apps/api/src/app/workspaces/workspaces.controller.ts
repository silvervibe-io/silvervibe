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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CreateWorkspaceDto } from './create-workspace.dto';
import { SetToolEntitlementDto } from './set-tool-entitlement.dto';
import { WorkspaceDto } from './workspace.dto';
import { WorkspaceToolDto } from './workspace-tool.dto';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a workspace',
    description:
      'Foundation helper to create a workspace so tool entitlements can be granted.',
  })
  @ApiOkResponse({ type: WorkspaceDto })
  @ApiUnauthorizedResponse()
  async create(@Body() body: CreateWorkspaceDto): Promise<WorkspaceDto> {
    const workspace = await this.workspaces.create(body.name, body.slug);
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    };
  }

  @Get(':workspaceId/tools')
  @ApiOperation({
    summary: 'List workspace tool entitlements',
    description:
      'Ownership rows from `workspace_tools` (not GrowthBook rollout flags).',
  })
  @ApiOkResponse({ type: WorkspaceToolDto, isArray: true })
  @ApiUnauthorizedResponse()
  async listTools(
    @Param('workspaceId') workspaceId: string,
  ): Promise<WorkspaceToolDto[]> {
    return this.workspaces.listTools(workspaceId);
  }

  @Put(':workspaceId/tools/:toolKey')
  @ApiOperation({
    summary: 'Grant or revoke a tool entitlement',
    description:
      '`enabled: true` grants (upserts); `enabled: false` revokes. `toolKey` must be a known TOOL_KEYS value.',
  })
  @ApiOkResponse({ type: WorkspaceToolDto })
  @ApiUnauthorizedResponse()
  async setTool(
    @Param('workspaceId') workspaceId: string,
    @Param('toolKey') toolKey: string,
    @Body() body: SetToolEntitlementDto,
  ): Promise<WorkspaceToolDto> {
    return this.workspaces.setToolEntitlement(
      workspaceId,
      toolKey,
      body.enabled,
    );
  }
}
