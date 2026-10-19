import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MeDto {
  @ApiProperty({ description: 'Neon user id (cuid)' })
  id!: string;

  @ApiProperty({ description: 'Firebase Auth uid' })
  firebaseUid!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  displayName!: string | null;
}
