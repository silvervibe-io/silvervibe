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
