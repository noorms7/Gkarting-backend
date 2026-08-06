import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CheckAvailabilityDto {
  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '14:30' })
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:mm 24h format' })
  startTime: string;

  @ApiProperty({ example: 45 })
  @IsInt()
  @Min(5)
  @Max(300)
  durationMins: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(20)
  kartsCount: number;
}

export class CreateBookingDto {
  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '14:30' })
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:mm 24h format' })
  startTime: string;

  @ApiProperty()
  @IsUUID()
  packageId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(20)
  kartsCount: number;

  @ApiPropertyOptional({
    description: 'Names of friends riding extra karts in the same booking',
    example: ['Sam', 'Jordan'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  riderNames?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialNotes?: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'RACE10' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}

export class RescheduleBookingDto {
  @ApiProperty({ example: '2026-08-11' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '15:00' })
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:mm 24h format' })
  startTime: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class UpdateBookingStatusDto {
  @ApiProperty({ example: 'CONFIRMED' })
  @IsIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
