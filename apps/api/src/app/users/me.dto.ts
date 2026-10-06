import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firebaseUid!: string;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;
}
