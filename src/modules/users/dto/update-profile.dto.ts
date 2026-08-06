import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Alex' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rossi' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ example: '+96170123456' })
  @IsOptional()
  @Matches(PHONE_REGEX, {
    message: 'Phone number must be a valid number (7-15 digits, optional +)',
  })
  phone?: string;
}
