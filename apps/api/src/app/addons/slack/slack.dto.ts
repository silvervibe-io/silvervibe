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
    description: 'True when an Incoming Webhook is stored (URL never returned)',
  })
  configured!: boolean;

  @ApiPropertyOptional({ nullable: true })
  channelLabel!: string | null;

  @ApiProperty({
    description: 'Whether workspace tool entitlement addons.slack is enabled',
  })
  toolEnabled!: boolean;
}

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
