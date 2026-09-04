import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class FollowUpAppointmentDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(4)
  time!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMin?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
