import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class TeamsConnectionDto {
  @ApiProperty({ enum: ['DISCONNECTED', 'PENDING', 'CONNECTED', 'ERROR'] })
  status!: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';

  @ApiProperty({
    description:
      'True when OAuth tokens or a legacy Incoming Webhook are stored (secret never returned)',
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
    description:
      'True when OAuth tokens exist but a Teams team/channel has not been chosen yet',
  })
  needsChannel!: boolean;

  @ApiProperty({
    description: 'Whether workspace tool entitlement addons.teams is enabled',
  })
  toolEnabled!: boolean;

  @ApiProperty({
    description:
      'True when TEAMS_CLIENT_ID / TEAMS_CLIENT_SECRET are set on the server',
  })
  oauthAvailable!: boolean;
}

export class TeamsOAuthStartDto {
  @ApiProperty({
    description: 'Microsoft Entra authorize URL to open in the browser',
  })
  authorizeUrl!: string;
}

export class TeamsGraphTeamDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  displayName!: string;
}

export class TeamsGraphChannelDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  displayName!: string;
}

export class SelectTeamsChannelDto {
  @ApiProperty({ description: 'Microsoft Teams team (group) id' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  teamId!: string;

  @ApiProperty({ description: 'Microsoft Teams channel id' })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  channelId!: string;

  @ApiPropertyOptional({ description: 'Display label, e.g. General' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  channelLabel?: string;
}

/** @deprecated Prefer OAuth start; kept for migration of existing webhook installs. */
export class ConnectTeamsDto {
  @ApiProperty({
    description:
      'Microsoft Teams Incoming Webhook URL (outlook.office.com or webhook.office.com)',
  })
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MinLength(32)
  @MaxLength(1024)
  incomingWebhookUrl!: string;

  @ApiPropertyOptional({ description: 'Display label, e.g. Standups channel' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  channelLabel?: string;
}
