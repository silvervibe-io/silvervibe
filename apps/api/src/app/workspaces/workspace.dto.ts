import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}
