import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceToolDto {
  @ApiProperty({ example: 'vibestandup' })
  toolKey!: string;

  @ApiProperty()
  enabled!: boolean;
}
