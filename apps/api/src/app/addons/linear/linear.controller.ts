import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddonStatusDto } from '../addon-status.dto';
import { LinearService } from './linear.service';

@ApiTags('linear')
@Controller('addons/linear')
export class LinearController {
  constructor(private readonly linear: LinearService) {}

  @Get('status')
  @ApiOperation({ summary: 'Linear add-on status' })
  @ApiOkResponse({ type: AddonStatusDto })
  status(): AddonStatusDto {
    return this.linear.status();
  }
}
