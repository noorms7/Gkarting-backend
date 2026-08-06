import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ example: 'Best 45 minutes I have had all year.' })
  @IsString()
  @MaxLength(1000)
  comment: string;

  @ApiPropertyOptional({
    description: 'Optional: link the review to a specific completed booking',
  })
  @IsOptional()
  @IsUUID()
  bookingId?: string;
}

export class RejectReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
