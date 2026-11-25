import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFeedbackRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  context?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  prompts!: string[];

  @ApiProperty({
    enum: ['PRIVATE_TO_REQUESTER', 'SHARED_WITH_INVITEES'],
    default: 'PRIVATE_TO_REQUESTER',
  })
  @IsIn(['PRIVATE_TO_REQUESTER', 'SHARED_WITH_INVITEES'])
  answerVisibility!: 'PRIVATE_TO_REQUESTER' | 'SHARED_WITH_INVITEES';

  @ApiProperty({ default: false })
  @IsBoolean()
  anonymous!: boolean;

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

export class UpdateFeedbackSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  context?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prompts?: string[];

  @ApiPropertyOptional({
    enum: ['PRIVATE_TO_REQUESTER', 'SHARED_WITH_INVITEES'],
  })
  @IsOptional()
  @IsIn(['PRIVATE_TO_REQUESTER', 'SHARED_WITH_INVITEES'])
  answerVisibility?: 'PRIVATE_TO_REQUESTER' | 'SHARED_WITH_INVITEES';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;

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

export class SetFeedbackInvitesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];
}

export class UpsertFeedbackAnswerItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  promptId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class UpsertFeedbackAnswersDto {
  @ApiProperty({ type: [UpsertFeedbackAnswerItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertFeedbackAnswerItemDto)
  answers!: UpsertFeedbackAnswerItemDto[];
}

export class CloseFeedbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;
}

export class FeedbackInviteDto {
  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  displayName?: string | null;
}

export class FeedbackPromptDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  sortOrder!: number;
}

export class FeedbackAnswerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  promptId!: string;

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

export class FeedbackSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  context!: string | null;

  @ApiProperty({ enum: ['DRAFT', 'OPEN', 'CLOSED'] })
  status!: 'DRAFT' | 'OPEN' | 'CLOSED';

  @ApiProperty({ enum: ['PRIVATE_TO_REQUESTER', 'SHARED_WITH_INVITEES'] })
  answerVisibility!: 'PRIVATE_TO_REQUESTER' | 'SHARED_WITH_INVITEES';

  @ApiProperty()
  anonymous!: boolean;

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
  promptCount!: number;

  @ApiProperty()
  answerCount!: number;

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

export class FeedbackDetailDto extends FeedbackSummaryDto {
  @ApiPropertyOptional()
  summary!: string | null;

  @ApiProperty({ type: [FeedbackInviteDto] })
  invites!: FeedbackInviteDto[];

  @ApiProperty({ type: [FeedbackPromptDto] })
  prompts!: FeedbackPromptDto[];

  @ApiProperty({ type: [FeedbackAnswerDto] })
  answers!: FeedbackAnswerDto[];

  @ApiProperty()
  canAnswer!: boolean;

  @ApiProperty()
  canClose!: boolean;

  @ApiProperty()
  canEditSettings!: boolean;
}
