import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateFollowUpDto {
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
