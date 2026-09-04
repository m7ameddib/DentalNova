import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class UpdateClinicSettingsDto {
  @IsOptional()
  @IsString()
  clinicName?: string;

  @IsOptional()
  @IsString()
  clinicPhone?: string;

  /** Doctor's personal WhatsApp number — used only by the manual "Send Today's Appointments" action. */
  @IsOptional()
  @IsString()
  doctorPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  /** CSV of weekday numbers, 0 (Sunday) through 6 (Saturday). */
  @IsOptional()
  @IsString()
  workingDays?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'workStartTime must be in HH:mm format' })
  workStartTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'workEndTime must be in HH:mm format' })
  workEndTime?: string;

  @IsOptional()
  @IsIn(['en', 'ar'])
  whatsappMessageLanguage?: 'en' | 'ar';

  @IsOptional()
  @IsString()
  whatsappAppointmentReminderEn?: string;

  @IsOptional()
  @IsString()
  whatsappAppointmentReminderAr?: string;

  @IsOptional()
  @IsString()
  whatsappClinicalFollowupEn?: string;

  @IsOptional()
  @IsString()
  whatsappClinicalFollowupAr?: string;

  @IsOptional()
  @IsString()
  whatsappFinancialFollowupEn?: string;

  @IsOptional()
  @IsString()
  whatsappFinancialFollowupAr?: string;

  @IsOptional()
  @IsString()
  doctorNameAr?: string;

  @IsOptional()
  @IsString()
  doctorNameEn?: string;

  @IsOptional()
  @IsString()
  doctorTitleAr?: string;

  @IsOptional()
  @IsString()
  doctorTitleEn?: string;

  @IsOptional()
  @IsString()
  doctorLicenseNo?: string;
}
