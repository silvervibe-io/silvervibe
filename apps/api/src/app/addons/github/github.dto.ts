import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class GithubConnectionDto {
  @ApiProperty({ enum: ['DISCONNECTED', 'PENDING', 'CONNECTED', 'ERROR'] })
  status!: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';

  @ApiProperty({
    description:
      'True when an OAuth access token is stored (secret never returned)',
  })
  configured!: boolean;

  @ApiPropertyOptional({ nullable: true })
  repoFullName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  issueNumber!: number | null;

  @ApiPropertyOptional({ nullable: true })
  issueTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  accountLogin!: string | null;

  @ApiProperty({
    description: 'Whether workspace tool entitlement addons.github is enabled',
  })
  toolEnabled!: boolean;

  @ApiProperty({
    description: 'True when GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET are set',
  })
  oauthAvailable!: boolean;
}

export class GithubOAuthStartDto {
  @ApiProperty({
    description: 'GitHub OAuth authorize URL to open in the browser',
  })
  authorizeUrl!: string;
}

export class GithubRepoDto {
  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  owner!: string;

  @ApiProperty()
  name!: string;
}

export class GithubIssueDto {
  @ApiProperty()
  number!: number;

  @ApiProperty()
  title!: string;
}

export class SelectGithubTargetDto {
  @ApiProperty({ description: 'Repository owner (user or org login)' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  owner!: string;

  @ApiProperty({ description: 'Repository name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  repo!: string;

  @ApiProperty({
    description: 'Issue number that receives standup digest comments',
  })
  @IsInt()
  @Min(1)
  issueNumber!: number;
}
