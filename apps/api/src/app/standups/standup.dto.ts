import { ApiProperty } from '@nestjs/swagger';

export class StandupConfigDto {
  @ApiProperty()
  teamId!: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  questionsJson!: Record<string, string>;
}

export class UpdateStandupConfigDto {
  @ApiProperty()
  timezone!: string;

  @ApiProperty()
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
  yesterday!: string;

  @ApiProperty()
  today!: string;

  @ApiProperty()
  blockers!: string;

  @ApiProperty({ enum: ['DRAFT', 'SUBMITTED'] })
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
