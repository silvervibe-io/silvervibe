import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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
  @ApiProperty({ example: 'Platform' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'platform' })
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers, and hyphens',
  })
  slug!: string;
}

export class InviteTeamMemberDto {
  @ApiProperty({ description: 'Firebase UID or existing Neon user id' })
  @IsString()
  @MinLength(1)
  userId!: string;

  @ApiProperty({ enum: ['ADMIN', 'MEMBER'], required: false })
  @IsOptional()
  @IsIn(['ADMIN', 'MEMBER'])
  role?: 'ADMIN' | 'MEMBER';
}

export class CreateTeamInviteDto {
  @ApiProperty({ example: 'teammate@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['ADMIN', 'MEMBER'], required: false })
  @IsOptional()
  @IsIn(['ADMIN', 'MEMBER'])
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

export class TeamInviteDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  teamId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ['ADMIN', 'MEMBER'] })
  role!: 'ADMIN' | 'MEMBER';

  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'REVOKED'] })
  status!: 'PENDING' | 'ACCEPTED' | 'REVOKED';

  @ApiProperty()
  token!: string;

  @ApiProperty({
    description: 'Relative path for the invitee to open after sign-in',
  })
  acceptPath!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty({
    required: false,
    description: 'Set when the invitee was added immediately (already a user)',
  })
  member?: TeamMemberDto;

  @ApiProperty({
    required: false,
    description:
      'True when an invite email was sent via Resend for this response',
  })
  emailSent?: boolean;
}

export class AcceptTeamInviteDto {
  @ApiProperty()
  teamId!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  member!: TeamMemberDto;
}
