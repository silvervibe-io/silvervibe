import { ApiProperty } from '@nestjs/swagger';

export class TeamDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class MyTeamDto extends TeamDto {
  @ApiProperty({ enum: ['ADMIN', 'MEMBER'] })
  role!: 'ADMIN' | 'MEMBER';
}

export class CreateTeamDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class InviteTeamMemberDto {
  @ApiProperty({ description: 'Firebase UID or existing Neon user id' })
  userId!: string;

  @ApiProperty({ enum: ['ADMIN', 'MEMBER'], required: false })
  role?: 'ADMIN' | 'MEMBER';
}

export class TeamMemberDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: ['ADMIN', 'MEMBER'] })
  role!: 'ADMIN' | 'MEMBER';

  @ApiProperty({ required: false, nullable: true })
  email?: string | null;

  @ApiProperty({ required: false, nullable: true })
  displayName?: string | null;
}
