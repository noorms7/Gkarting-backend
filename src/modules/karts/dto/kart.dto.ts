import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { KartStatus } from '@prisma/client';

export class CreateKartDto {
  @ApiProperty({ example: 'K-13' })
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Racing Kart 13' })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ enum: KartStatus })
  @IsOptional()
  @IsEnum(KartStatus)
  status?: KartStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateKartDto {
  @ApiPropertyOptional({ example: 'Racing Kart 13' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: KartStatus })
  @IsOptional()
  @IsEnum(KartStatus)
  status?: KartStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
