import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel } from '../row-mapper.util';
import { ClinicSettings } from '../../common/types';

export interface UpdateClinicSettingsInput {
  clinicName?: string | null;
  clinicPhone?: string | null;
  doctorPhone?: string | null;
  address?: string | null;
  logoPath?: string | null;
  logoOriginalName?: string | null;
  workingDays?: string;
  workStartTime?: string;
  workEndTime?: string;
  whatsappMessageLanguage?: 'en' | 'ar';
  whatsappAppointmentReminderEn?: string | null;
  whatsappAppointmentReminderAr?: string | null;
  whatsappClinicalFollowupEn?: string | null;
  whatsappClinicalFollowupAr?: string | null;
  whatsappFinancialFollowupEn?: string | null;
  whatsappFinancialFollowupAr?: string | null;
  doctorNameAr?: string | null;
  doctorNameEn?: string | null;
  doctorTitleAr?: string | null;
  doctorTitleEn?: string | null;
  doctorLicenseNo?: string | null;
}

const SETTINGS_ID = 1;

@Injectable()
export class ClinicSettingsRepository {
  constructor(private readonly db: DatabaseService) {}

  get(): ClinicSettings {
    const row = this.db.connection
      .prepare('SELECT * FROM clinic_settings WHERE id = ?')
      .get(SETTINGS_ID) as Record<string, unknown> | undefined;
    if (!row) {
      // Defensive fallback in case the seed row is somehow missing.
      this.db.connection
        .prepare(
          `INSERT OR IGNORE INTO clinic_settings (id, work_start_time, work_end_time) VALUES (?, '09:00', '18:00')`,
        )
        .run(SETTINGS_ID);
      return this.get();
    }
    return toCamel<ClinicSettings>(row);
  }

  update(input: UpdateClinicSettingsInput): ClinicSettings {
    const existing = this.get();
    const merged = { ...existing, ...input };
    this.db.connection
      .prepare(
        `UPDATE clinic_settings SET
          clinic_name = ?, clinic_phone = ?, doctor_phone = ?, address = ?, logo_path = ?, logo_original_name = ?,
          working_days = ?, work_start_time = ?, work_end_time = ?,
          whatsapp_message_language = ?, whatsapp_appointment_reminder_en = ?, whatsapp_appointment_reminder_ar = ?,
          whatsapp_clinical_followup_en = ?, whatsapp_clinical_followup_ar = ?,
          whatsapp_financial_followup_en = ?, whatsapp_financial_followup_ar = ?,
          doctor_name_ar = ?, doctor_name_en = ?, doctor_title_ar = ?, doctor_title_en = ?, doctor_license_no = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        merged.clinicName ?? null,
        merged.clinicPhone ?? null,
        merged.doctorPhone ?? null,
        merged.address ?? null,
        merged.logoPath ?? null,
        merged.logoOriginalName ?? null,
        merged.workingDays,
        merged.workStartTime,
        merged.workEndTime,
        merged.whatsappMessageLanguage ?? 'en',
        merged.whatsappAppointmentReminderEn ?? null,
        merged.whatsappAppointmentReminderAr ?? null,
        merged.whatsappClinicalFollowupEn ?? null,
        merged.whatsappClinicalFollowupAr ?? null,
        merged.whatsappFinancialFollowupEn ?? null,
        merged.whatsappFinancialFollowupAr ?? null,
        merged.doctorNameAr ?? null,
        merged.doctorNameEn ?? null,
        merged.doctorTitleAr ?? null,
        merged.doctorTitleEn ?? null,
        merged.doctorLicenseNo ?? null,
        SETTINGS_ID,
      );
    return this.get();
  }
}
