import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TrelloConnectionDto {
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
    description: 'Whether workspace tool entitlement addons.trello is enabled',
  })
  toolEnabled!: boolean;

  @ApiProperty({
    description: 'True when TRELLO_CLIENT_ID / TRELLO_CLIENT_SECRET are set',
  })
  oauthAvailable!: boolean;
}

export class TrelloOAuthStartDto {
  @ApiProperty({
    description: 'Trello OAuth authorize URL to open in the browser',
  })
  authorizeUrl!: string;
}
