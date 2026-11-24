import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePollDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question!: string;

  @ApiProperty({ type: [String], minItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  options!: string[];

  @ApiProperty({ default: false })
  @IsBoolean()
  allowMulti!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  inviteUserIds!: string[];
}

export class CastVoteDto {
  @ApiProperty({ type: [String], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  optionIds!: string[];
}

export class SetPollInvitesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];
}

export class PollOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  sortOrder!: number;
}

export class PollInviteDto {
  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  displayName?: string | null;
}

export class PollSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  question!: string;

  @ApiProperty()
  allowMulti!: boolean;

  @ApiProperty({ enum: ['DRAFT', 'OPEN', 'CLOSED'] })
  status!: 'DRAFT' | 'OPEN' | 'CLOSED';

  @ApiPropertyOptional()
  startsAt!: string | null;

  @ApiPropertyOptional()
  endsAt!: string | null;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  optionCount!: number;

  @ApiProperty()
  inviteCount!: number;

  @ApiProperty()
  hasVoted!: boolean;
}

export class PollDetailDto extends PollSummaryDto {
  @ApiProperty({ type: [PollOptionDto] })
  options!: PollOptionDto[];

  @ApiProperty({ type: [PollInviteDto] })
  invites!: PollInviteDto[];

  @ApiProperty({ type: [String] })
  myOptionIds!: string[];

  @ApiProperty()
  canVote!: boolean;

  @ApiProperty()
  canClose!: boolean;

  @ApiProperty()
  canSeeResults!: boolean;
}

export class PollResultOptionDto {
  @ApiProperty()
  optionId!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  voteCount!: number;
}

export class PollResultsDto {
  @ApiProperty()
  pollId!: string;

  @ApiProperty()
  totalBallots!: number;

  @ApiProperty({ type: [PollResultOptionDto] })
  options!: PollResultOptionDto[];
}

export class WorkspaceMemberDto {
  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  displayName?: string | null;

  @ApiProperty({ enum: ['OWNER', 'ADMIN', 'MEMBER'] })
  role!: 'OWNER' | 'ADMIN' | 'MEMBER';
}
