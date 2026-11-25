import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRetroDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    enum: ['LIVE', 'PRIVATE_UNTIL_CLOSE', 'AFTER_CONTRIBUTE'],
    default: 'LIVE',
  })
  @IsIn(['LIVE', 'PRIVATE_UNTIL_CLOSE', 'AFTER_CONTRIBUTE'])
  noteVisibility!: 'LIVE' | 'PRIVATE_UNTIL_CLOSE' | 'AFTER_CONTRIBUTE';

  @ApiProperty({
    enum: ['CREATOR_OR_ADMIN', 'CREATOR_ONLY', 'ANY_INVITEE'],
    default: 'CREATOR_OR_ADMIN',
  })
  @IsIn(['CREATOR_OR_ADMIN', 'CREATOR_ONLY', 'ANY_INVITEE'])
  closePolicy!: 'CREATOR_OR_ADMIN' | 'CREATOR_ONLY' | 'ANY_INVITEE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  inviteUserIds!: string[];
}

export class UpdateRetroSettingsDto {
  @ApiPropertyOptional({
    enum: ['LIVE', 'PRIVATE_UNTIL_CLOSE', 'AFTER_CONTRIBUTE'],
  })
  @IsOptional()
  @IsIn(['LIVE', 'PRIVATE_UNTIL_CLOSE', 'AFTER_CONTRIBUTE'])
  noteVisibility?: 'LIVE' | 'PRIVATE_UNTIL_CLOSE' | 'AFTER_CONTRIBUTE';

  @ApiPropertyOptional({
    enum: ['CREATOR_OR_ADMIN', 'CREATOR_ONLY', 'ANY_INVITEE'],
  })
  @IsOptional()
  @IsIn(['CREATOR_OR_ADMIN', 'CREATOR_ONLY', 'ANY_INVITEE'])
  closePolicy?: 'CREATOR_OR_ADMIN' | 'CREATOR_ONLY' | 'ANY_INVITEE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endsAt?: string | null;
}

export class SetRetroInvitesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];
}

export class UpsertRetroNoteDto {
  @ApiProperty({ enum: ['WENT_WELL', 'IMPROVE', 'ACTIONS'] })
  @IsIn(['WENT_WELL', 'IMPROVE', 'ACTIONS'])
  column!: 'WENT_WELL' | 'IMPROVE' | 'ACTIONS';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

export class CloseRetroDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;
}

export class RetroInviteDto {
  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  displayName?: string | null;
}

export class RetroNoteDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['WENT_WELL', 'IMPROVE', 'ACTIONS'] })
  column!: 'WENT_WELL' | 'IMPROVE' | 'ACTIONS';

  @ApiProperty()
  body!: string;

  @ApiProperty()
  authorId!: string;

  @ApiPropertyOptional()
  authorDisplayName?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty()
  mine!: boolean;
}

export class RetroSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: ['DRAFT', 'OPEN', 'CLOSED'] })
  status!: 'DRAFT' | 'OPEN' | 'CLOSED';

  @ApiProperty({ enum: ['LIVE', 'PRIVATE_UNTIL_CLOSE', 'AFTER_CONTRIBUTE'] })
  noteVisibility!: 'LIVE' | 'PRIVATE_UNTIL_CLOSE' | 'AFTER_CONTRIBUTE';

  @ApiProperty({ enum: ['CREATOR_OR_ADMIN', 'CREATOR_ONLY', 'ANY_INVITEE'] })
  closePolicy!: 'CREATOR_OR_ADMIN' | 'CREATOR_ONLY' | 'ANY_INVITEE';

  @ApiPropertyOptional()
  endsAt!: string | null;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  inviteCount!: number;

  @ApiProperty()
  noteCount!: number;

  @ApiProperty()
  hasContributed!: boolean;
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

export class RetroDetailDto extends RetroSummaryDto {
  @ApiPropertyOptional()
  summary!: string | null;

  @ApiProperty({ type: [RetroInviteDto] })
  invites!: RetroInviteDto[];

  @ApiProperty({ type: [RetroNoteDto] })
  notes!: RetroNoteDto[];

  @ApiProperty()
  canAddNotes!: boolean;

  @ApiProperty()
  canClose!: boolean;

  @ApiProperty()
  canEditSettings!: boolean;
}
