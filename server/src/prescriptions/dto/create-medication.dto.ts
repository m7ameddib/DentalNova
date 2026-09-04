import { IsIn, IsOptional, IsString } from 'class-validator';

export const MEDICATION_CATEGORIES = ['ANTIBIOTICS', 'PAINKILLERS', 'ANTI_INFLAMMATORY', 'MOUTHWASH', 'OTHER'] as const;

export class CreateMedicationDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  strengthForm?: string;

  @IsIn(MEDICATION_CATEGORIES)
  category!: (typeof MEDICATION_CATEGORIES)[number];

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
}
