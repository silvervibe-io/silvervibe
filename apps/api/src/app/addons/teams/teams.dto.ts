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
    description: 'True when an Incoming Webhook is stored (URL never returned)',
  })
  configured!: boolean;

  @ApiPropertyOptional({ nullable: true })
  channelLabel!: string | null;

  @ApiProperty({
    description: 'Whether workspace tool entitlement addons.teams is enabled',
  })
  toolEnabled!: boolean;
}

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
