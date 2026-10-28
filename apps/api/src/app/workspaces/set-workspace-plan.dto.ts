import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class SetWorkspacePlanDto {
  @ApiProperty({
    enum: ['free', 'team'],
    description:
      'Workspace commercial plan (pre-billing unlock). Enforced for team/member limits.',
  })
  @IsString()
  @IsIn(['free', 'team'])
  planKey!: 'free' | 'team';
}
