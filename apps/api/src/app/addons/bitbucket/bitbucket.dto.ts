import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BitbucketConnectionDto {
  @ApiProperty({ enum: ['DISCONNECTED', 'PENDING', 'CONNECTED', 'ERROR'] })
  status!: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';

  @ApiProperty({
    description:
      'True when an OAuth access token is stored (secret never returned)',
  })
  configured!: boolean;

  @ApiPropertyOptional({ nullable: true })
  accountLogin!: string | null;

  @ApiProperty({
    description:
      'Whether workspace tool entitlement addons.bitbucket is enabled',
  })
  toolEnabled!: boolean;

  @ApiProperty({
    description:
      'True when BITBUCKET_CLIENT_ID / BITBUCKET_CLIENT_SECRET are set',
  })
  oauthAvailable!: boolean;
}

export class BitbucketOAuthStartDto {
  @ApiProperty({
    description: 'Bitbucket OAuth authorize URL to open in the browser',
  })
  authorizeUrl!: string;
}
