import { IsIn, IsOptional, IsString } from 'class-validator';
import { MEDICAL_ALERT_TYPES } from './create-medical-alert.dto';

export class UpdateMedicalAlertDto {
  @IsOptional()
  @IsIn(MEDICAL_ALERT_TYPES)
  alertType?: (typeof MEDICAL_ALERT_TYPES)[number];

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
