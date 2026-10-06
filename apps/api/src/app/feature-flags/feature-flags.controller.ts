import { Controller, Get, Headers, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { FLAG_KEYS } from '@silvervibe/shared/feature-flags';
import { FeatureFlagsService } from './feature-flags.service';

class FlagEvaluationDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  enabled!: boolean;
}

@ApiTags('flags')
@Controller('flags')
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Get('vibestandup')
  @ApiOperation({ summary: 'Evaluate vibestandup rollout flag' })
  @ApiOkResponse({ type: FlagEvaluationDto })
  async vibestandup(
    @Query('workspaceId') workspaceId?: string,
    @Headers('x-firebase-uid') firebaseUid?: string,
  ): Promise<FlagEvaluationDto> {
    const enabled = await this.flags.booleanFlag(
      FLAG_KEYS.toolsVibestandupEnabled,
      false,
      { workspaceId, firebaseUid },
    );
    return { key: FLAG_KEYS.toolsVibestandupEnabled, enabled };
  }
}
