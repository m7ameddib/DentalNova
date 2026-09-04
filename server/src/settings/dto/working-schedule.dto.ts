import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

export class WorkingPeriodDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime!: string;
}

export class WeeklyDayScheduleDto {
  @IsOptional()
  dayOfWeek?: number;

  @IsBoolean()
  isOpen!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingPeriodDto)
  periods!: WorkingPeriodDto[];
}

export class SaveWeeklyScheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyDayScheduleDto)
  days!: WeeklyDayScheduleDto[];
}

export class CreateScheduleExceptionDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  exceptionDate!: string;

  @IsBoolean()
  isClosed!: boolean;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingPeriodDto)
  periods?: WorkingPeriodDto[];
}

export class UpdateScheduleExceptionDto {
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingPeriodDto)
  periods?: WorkingPeriodDto[];
}
