import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetToolEntitlementDto {
  @ApiProperty({
    description: 'true = grant / keep entitlement; false = revoke',
  })
  @IsBoolean()
  enabled!: boolean;
}
