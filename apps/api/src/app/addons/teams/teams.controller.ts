import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddonStatusDto } from '../addon-status.dto';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller('addons/teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Microsoft Teams add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.teams.status();
  }
}
