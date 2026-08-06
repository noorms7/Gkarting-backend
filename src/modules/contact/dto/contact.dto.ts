import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContactMessageDto {
  @ApiProperty({ example: 'Sam Rider' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'sam@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+96170123456' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'Group booking question' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  subject?: string;

  @ApiProperty({ example: 'Can we book 10 karts for a birthday party?' })
  @IsString()
  @MaxLength(2000)
  message: string;
}

export class ReplyContactMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  replyText: string;
}
