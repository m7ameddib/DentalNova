import { IsIn, IsInt, IsOptional, IsString, ValidateIf } from 'class-validator';

export const MEDICAL_ALERT_TYPES = [
  'ALLERGY',
  'PENICILLIN_ALLERGY',
  'ANTICOAGULANTS',
  'DIABETES',
  'HYPERTENSION',
  'PREGNANCY',
  'HEART_CONDITION',
  'DISEASE',
  'OTHER',
] as const;

export class CreateMedicalAlertDto {
  @ValidateIf((o) => !o.diseaseCatalogId)
  @IsIn(MEDICAL_ALERT_TYPES)
  alertType?: (typeof MEDICAL_ALERT_TYPES)[number];

  @IsOptional()
  @IsInt()
  diseaseCatalogId?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
