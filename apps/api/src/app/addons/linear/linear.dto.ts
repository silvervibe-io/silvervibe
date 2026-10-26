import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LinearConnectionDto {
  @ApiProperty({ enum: ['DISCONNECTED', 'PENDING', 'CONNECTED', 'ERROR'] })
  status!: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';

  @ApiProperty({
    description:
      'True when an OAuth access token is stored (secret never returned)',
  })
  configured!: boolean;

  @ApiPropertyOptional({ nullable: true })
  projectId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  projectName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  organizationName!: string | null;

  @ApiProperty({
    description: 'Whether workspace tool entitlement addons.linear is enabled',
  })
  toolEnabled!: boolean;

  @ApiProperty({
    description: 'True when LINEAR_CLIENT_ID / LINEAR_CLIENT_SECRET are set',
  })
  oauthAvailable!: boolean;
}

export class LinearOAuthStartDto {
  @ApiProperty({
    description: 'Linear OAuth authorize URL to open in the browser',
  })
  authorizeUrl!: string;
}

export class LinearProjectDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class SelectLinearProjectDto {
  @ApiProperty({ description: 'Linear project UUID for standup digests' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  projectId!: string;
}
