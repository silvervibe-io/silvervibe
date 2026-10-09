import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MeDto {
  @ApiProperty({ description: 'Neon user id (cuid)' })
  id!: string;

  @ApiProperty({ description: 'Firebase Auth uid' })
  firebaseUid!: string;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  displayName!: string | null;
}
