import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { TrackOperationalStatus } from '@prisma/client';

export class UpdateTrackStatusDto {
  @ApiPropertyOptional({ enum: TrackOperationalStatus })
  @IsOptional()
  @IsEnum(TrackOperationalStatus)
  operationalStatus?: TrackOperationalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledReopenAt?: string;
}

export class UpdateBusinessHourDto {
  @ApiPropertyOptional()
  @IsOptional()
  isOpen?: boolean;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  openTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  closeTime?: string;
}

export class CreateBlockedDateDto {
  @ApiPropertyOptional({ example: '2026-12-25' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  wholeDay?: boolean;

  @ApiPropertyOptional({ example: '13:00' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ example: '15:00' })
  @IsOptional()
  @IsString()
  endTime?: string;
}
