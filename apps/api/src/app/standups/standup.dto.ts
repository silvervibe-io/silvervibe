import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  Matches,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class StandupQuestionOptionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  id!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;
}

export class StandupQuestionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  id!: string;

  @ApiProperty({ enum: ['text', 'choice'] })
  @IsIn(['text', 'choice'])
  type!: 'text' | 'choice';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  prompt!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty()
  @IsBoolean()
  required!: boolean;

  @ApiPropertyOptional({
    enum: ['yesterday', 'today', 'blockers', 'location', 'hours'],
  })
  @IsOptional()
  @IsIn(['yesterday', 'today', 'blockers', 'location', 'hours'])
  builtin?: 'yesterday' | 'today' | 'blockers' | 'location' | 'hours';

  @ApiPropertyOptional({ type: [StandupQuestionOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StandupQuestionOptionDto)
  options?: StandupQuestionOptionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowOther?: boolean;
}

export class StandupConfigDto {
  @ApiProperty()
  teamId!: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty({ minimum: 0, maximum: 23 })
  reminderHour!: number;

  @ApiProperty({ minimum: 0, maximum: 59 })
  reminderMinute!: number;

  @ApiProperty({ enum: ['deadline', 'window'] })
  scheduleKind!: 'deadline' | 'window';

  @ApiProperty({ minimum: 0, maximum: 23 })
  windowStartHour!: number;

  @ApiProperty({ minimum: 0, maximum: 59 })
  windowStartMinute!: number;

  @ApiProperty({ enum: ['live', 'together'] })
  reveal!: 'live' | 'together';

  @ApiProperty({ type: [StandupQuestionDto] })
  questionsJson!: StandupQuestionDto[];
}

export class UpdateStandupConfigDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  timezone!: string;

  @ApiProperty({ minimum: 0, maximum: 23 })
  @IsInt()
  @Min(0)
  @Max(23)
  reminderHour!: number;

  @ApiProperty({ minimum: 0, maximum: 59 })
  @IsInt()
  @Min(0)
  @Max(59)
  reminderMinute!: number;

  @ApiProperty({ enum: ['deadline', 'window'] })
  @IsIn(['deadline', 'window'])
  scheduleKind!: 'deadline' | 'window';

  @ApiProperty({ minimum: 0, maximum: 23 })
  @IsInt()
  @Min(0)
  @Max(23)
  windowStartHour!: number;

  @ApiProperty({ minimum: 0, maximum: 59 })
  @IsInt()
  @Min(0)
  @Max(59)
  windowStartMinute!: number;

  @ApiProperty({ enum: ['live', 'together'] })
  @IsIn(['live', 'together'])
  reveal!: 'live' | 'together';

  @ApiProperty({ type: [StandupQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StandupQuestionDto)
  questionsJson!: StandupQuestionDto[];
}

export class StandupEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  teamId!: string;

  @ApiProperty()
  entryDate!: string;

  @ApiProperty({ enum: ['DRAFT', 'SUBMITTED'] })
  status!: 'DRAFT' | 'SUBMITTED';

  @ApiProperty({ required: false, nullable: true })
  yesterday!: string | null;

  @ApiProperty({ required: false, nullable: true })
  today!: string | null;

  @ApiProperty({ required: false, nullable: true })
  blockers!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  answersJson!: Record<
    string,
    {
      text?: string;
      optionId?: string;
      otherText?: string;
      helpFrom?: string;
      replyNeeded?: 'today' | 'week' | 'none';
    }
  >;
}

export class UpsertStandupEntryDto {
  @ApiProperty()
  @IsString()
  yesterday!: string;

  @ApiProperty()
  @IsString()
  today!: string;

  @ApiProperty()
  @IsString()
  blockers!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  answers?: Record<
    string,
    {
      text?: string;
      optionId?: string;
      otherText?: string;
      helpFrom?: string;
      replyNeeded?: 'today' | 'week' | 'none';
    }
  >;

  @ApiProperty({ enum: ['DRAFT', 'SUBMITTED'] })
  @IsIn(['DRAFT', 'SUBMITTED'])
  status!: 'DRAFT' | 'SUBMITTED';
}

export class MentionIssueDto {
  @ApiProperty({ enum: ['github', 'jira', 'linear'] })
  provider!: 'github' | 'jira' | 'linear';

  @ApiProperty()
  key!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  url!: string;
}

export class StandupAwayDatesDto {
  @ApiProperty({ type: [String] })
  dates!: string[];
}

export class SetStandupAwayDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty()
  @IsBoolean()
  away!: boolean;
}

export class StandupRosterMemberDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['posted', 'open', 'away'] })
  status!: 'posted' | 'open' | 'away';

  @ApiProperty({ required: false, nullable: true })
  today!: string | null;
}

export class StandupRecentDayDto {
  @ApiProperty()
  entryDate!: string;

  @ApiProperty({ required: false, nullable: true })
  content!: string | null;
}

export class StandupSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  teamId!: string;

  @ApiProperty()
  entryDate!: string;

  @ApiProperty()
  content!: string;
}
