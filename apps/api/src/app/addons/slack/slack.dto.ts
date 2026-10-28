import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SlackConnectionDto {
  @ApiProperty({ enum: ['DISCONNECTED', 'PENDING', 'CONNECTED', 'ERROR'] })
  status!: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';

  @ApiProperty({
    description:
      'True when a bot token or legacy Incoming Webhook is stored (secret never returned)',
  })
  configured!: boolean;

  @ApiPropertyOptional({
    description: 'oauth | webhook when configured; null when disconnected',
    nullable: true,
    enum: ['oauth', 'webhook'],
  })
  authMode!: 'oauth' | 'webhook' | null;

  @ApiPropertyOptional({ nullable: true })
  channelLabel!: string | null;

  @ApiProperty({
    description: 'Whether workspace tool entitlement addons.slack is enabled',
  })
  toolEnabled!: boolean;

  @ApiProperty({
    description: 'True when SLACK_CLIENT_ID / SLACK_CLIENT_SECRET are set',
  })
  oauthAvailable!: boolean;
}

export class SlackOAuthStartDto {
  @ApiProperty({
    description: 'Slack OAuth authorize URL to open in the browser',
  })
  authorizeUrl!: string;
}

export class SlackChannelOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Display name, e.g. #standups' })
  label!: string;
}

export class SlackChannelsDto {
  @ApiProperty({ type: [SlackChannelOptionDto] })
  channels!: SlackChannelOptionDto[];
}

export class TeamSlackChannelDto {
  @ApiProperty({
    description:
      'Effective channel for this team (override or workspace default)',
    nullable: true,
  })
  channelId!: string | null;

  @ApiProperty({ nullable: true })
  channelLabel!: string | null;

  @ApiProperty({
    description:
      'True when this team has an override (not using workspace default)',
  })
  isOverride!: boolean;

  @ApiProperty({
    description: 'Workspace default channel from Connect Slack',
    nullable: true,
  })
  workspaceChannelId!: string | null;

  @ApiProperty({ nullable: true })
  workspaceChannelLabel!: string | null;

  @ApiProperty()
  slackConnected!: boolean;
}

export class SetTeamSlackChannelDto {
  @ApiProperty({ description: 'Slack channel id, e.g. C01234567' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  channelId!: string;

  @ApiPropertyOptional({ description: 'Display label, e.g. #eng-standup' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  channelLabel?: string;
}

/** @deprecated Prefer OAuth start; kept for migration of existing webhook installs. */
export class ConnectSlackDto {
  @ApiProperty({
    description: 'Slack Incoming Webhook URL (https://hooks.slack.com/...)',
  })
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MinLength(32)
  @MaxLength(512)
  incomingWebhookUrl!: string;

  @ApiPropertyOptional({ description: 'Display label, e.g. #standups' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  channelLabel?: string;
}
