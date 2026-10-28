import { ApiProperty } from '@nestjs/swagger';

export class MeWorkspaceToolDto {
  @ApiProperty()
  toolKey!: string;

  @ApiProperty()
  enabled!: boolean;
}

export class MeWorkspaceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ enum: ['free', 'team'] })
  planKey!: 'free' | 'team';

  @ApiProperty({ enum: ['OWNER', 'ADMIN', 'MEMBER'] })
  role!: 'OWNER' | 'ADMIN' | 'MEMBER';

  @ApiProperty({ type: [MeWorkspaceToolDto] })
  tools!: MeWorkspaceToolDto[];
}
