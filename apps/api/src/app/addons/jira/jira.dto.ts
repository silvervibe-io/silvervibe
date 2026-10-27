import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class JiraConnectionDto {
  @ApiProperty({ enum: ['DISCONNECTED', 'PENDING', 'CONNECTED', 'ERROR'] })
  status!: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';

  @ApiProperty({
    description:
      'True when an OAuth access token is stored (secret never returned)',
  })
  configured!: boolean;

  @ApiPropertyOptional({ nullable: true })
  cloudId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  siteName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  projectKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  issueKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  issueSummary!: string | null;

  @ApiProperty({
    description: 'Whether workspace tool entitlement addons.jira is enabled',
  })
  toolEnabled!: boolean;

  @ApiProperty({
    description: 'True when JIRA_CLIENT_ID / JIRA_CLIENT_SECRET are set',
  })
  oauthAvailable!: boolean;
}

export class JiraOAuthStartDto {
  @ApiProperty({
    description: 'Atlassian OAuth authorize URL to open in the browser',
  })
  authorizeUrl!: string;
}

export class JiraSiteDto {
  @ApiProperty()
  cloudId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  url!: string;
}

export class JiraProjectDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  name!: string;
}

export class JiraIssueDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  summary!: string;
}

export class SelectJiraSiteDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  cloudId!: string;
}

export class SelectJiraTargetDto {
  @ApiProperty({ description: 'Atlassian cloud id (site)' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  cloudId!: string;

  @ApiProperty({ description: 'Jira project key, e.g. ENG' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  projectKey!: string;

  @ApiProperty({ description: 'Issue key for digest comments, e.g. ENG-12' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  issueKey!: string;
}
