import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class StandupConfigDto {
  @ApiProperty()
  teamId!: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty({ minimum: 0, maximum: 23 })
  reminderHour!: number;

  @ApiProperty({ minimum: 0, maximum: 59 })
  reminderMinute!: number;

  @ApiProperty()
  questionsJson!: Record<string, string>;
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

  @ApiProperty()
  @IsObject()
  questionsJson!: Record<string, string>;
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

  @ApiProperty({ enum: ['DRAFT', 'SUBMITTED'] })
  @IsIn(['DRAFT', 'SUBMITTED'])
  status!: 'DRAFT' | 'SUBMITTED';
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
