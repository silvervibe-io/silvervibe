import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';
import type { WeekSchedule } from './work-hours';

export class UserScheduleDto {
  @ApiProperty()
  timezone!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  workHours!: WeekSchedule;
}

export class UpdateUserScheduleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  timezone!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  workHours!: WeekSchedule;
}
