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

const MEETING_POLICIES = [
  'CREATOR_OR_ADMIN',
  'CREATOR_ONLY',
  'ANY_INVITEE',
] as const;

export type MeetingPolicyValue = (typeof MEETING_POLICIES)[number];

export class CreateMeetingDto {
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
  agendaItems!: string[];

  @ApiProperty({ enum: MEETING_POLICIES, default: 'CREATOR_OR_ADMIN' })
  @IsIn(MEETING_POLICIES)
  editPolicy!: MeetingPolicyValue;

  @ApiProperty({ enum: MEETING_POLICIES, default: 'CREATOR_OR_ADMIN' })
  @IsIn(MEETING_POLICIES)
  closePolicy!: MeetingPolicyValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  inviteUserIds!: string[];
}

export class UpdateMeetingSettingsDto {
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
  agendaItems?: string[];

  @ApiPropertyOptional({ enum: MEETING_POLICIES })
  @IsOptional()
  @IsIn(MEETING_POLICIES)
  editPolicy?: MeetingPolicyValue;

  @ApiPropertyOptional({ enum: MEETING_POLICIES })
  @IsOptional()
  @IsIn(MEETING_POLICIES)
  closePolicy?: MeetingPolicyValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string | null;
}

export class SetMeetingInvitesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];
}

export class MeetingDecisionInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class SetMeetingDecisionsDto {
  @ApiProperty({ type: [MeetingDecisionInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeetingDecisionInputDto)
  decisions!: MeetingDecisionInputDto[];
}

export class MeetingActionInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

export class SetMeetingActionsDto {
  @ApiProperty({ type: [MeetingActionInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeetingActionInputDto)
  actions!: MeetingActionInputDto[];
}

export class CloseMeetingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recap?: string;
}

export class MeetingInviteDto {
  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  displayName?: string | null;
}

export class MeetingAgendaItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  sortOrder!: number;
}

export class MeetingDecisionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class MeetingActionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  body!: string;

  @ApiPropertyOptional()
  assigneeId!: string | null;

  @ApiProperty()
  done!: boolean;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class MeetingSummaryDto {
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

  @ApiProperty({ enum: MEETING_POLICIES })
  editPolicy!: MeetingPolicyValue;

  @ApiProperty({ enum: MEETING_POLICIES })
  closePolicy!: MeetingPolicyValue;

  @ApiPropertyOptional()
  scheduledAt!: string | null;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  inviteCount!: number;

  @ApiProperty()
  agendaCount!: number;

  @ApiProperty()
  decisionCount!: number;

  @ApiProperty()
  actionCount!: number;
}

export class MeetingMemberDto {
  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  displayName?: string | null;

  @ApiProperty({ enum: ['OWNER', 'ADMIN', 'MEMBER'] })
  role!: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export class MeetingDetailDto extends MeetingSummaryDto {
  @ApiPropertyOptional()
  recap!: string | null;

  @ApiProperty({ type: [MeetingInviteDto] })
  invites!: MeetingInviteDto[];

  @ApiProperty({ type: [MeetingAgendaItemDto] })
  agendaItems!: MeetingAgendaItemDto[];

  @ApiProperty({ type: [MeetingDecisionDto] })
  decisions!: MeetingDecisionDto[];

  @ApiProperty({ type: [MeetingActionDto] })
  actions!: MeetingActionDto[];

  @ApiProperty()
  canEditNotes!: boolean;

  @ApiProperty()
  canClose!: boolean;

  @ApiProperty()
  canEditSettings!: boolean;
}
