import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GitlabConnectionDto {
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
    description: 'Whether workspace tool entitlement addons.gitlab is enabled',
  })
  toolEnabled!: boolean;

  @ApiProperty({
    description: 'True when GITLAB_CLIENT_ID / GITLAB_CLIENT_SECRET are set',
  })
  oauthAvailable!: boolean;
}

export class GitlabOAuthStartDto {
  @ApiProperty({
    description: 'GitLab OAuth authorize URL to open in the browser',
  })
  authorizeUrl!: string;
}
