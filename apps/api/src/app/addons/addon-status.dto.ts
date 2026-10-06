import { ApiProperty } from '@nestjs/swagger';

export class AddonStatusDto {
  @ApiProperty({ example: 'slack' })
  name!: string;

  @ApiProperty({ example: 'ready' })
  status!: 'ready';
}
