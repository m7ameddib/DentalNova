import { IsDateString, IsOptional } from 'class-validator';

export class ReportPeriodDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
