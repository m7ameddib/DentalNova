import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { MEDICATION_CATEGORIES } from './create-medication.dto';

export class UpdateMedicationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  strengthForm?: string;

  @IsOptional()
  @IsIn(MEDICATION_CATEGORIES)
  category?: (typeof MEDICATION_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  defaultDose?: string;

  @IsOptional()
  @IsString()
  defaultFrequency?: string;

  @IsOptional()
  @IsString()
  defaultDuration?: string;

  @IsOptional()
  @IsString()
  defaultInstructions?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
