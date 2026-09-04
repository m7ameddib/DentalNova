"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicSettingsRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database.service");
const row_mapper_util_1 = require("../row-mapper.util");
const SETTINGS_ID = 1;
let ClinicSettingsRepository = class ClinicSettingsRepository {
    constructor(db) {
        this.db = db;
    }
    get() {
        const row = this.db.connection
            .prepare('SELECT * FROM clinic_settings WHERE id = ?')
            .get(SETTINGS_ID);
        if (!row) {
            this.db.connection
                .prepare(`INSERT OR IGNORE INTO clinic_settings (id, work_start_time, work_end_time) VALUES (?, '09:00', '18:00')`)
                .run(SETTINGS_ID);
            return this.get();
        }
        return (0, row_mapper_util_1.toCamel)(row);
    }
    update(input) {
        const existing = this.get();
        const merged = { ...existing, ...input };
        this.db.connection
            .prepare(`UPDATE clinic_settings SET
          clinic_name = ?, clinic_phone = ?, doctor_phone = ?, address = ?, logo_path = ?, logo_original_name = ?,
          working_days = ?, work_start_time = ?, work_end_time = ?,
          whatsapp_message_language = ?, whatsapp_appointment_reminder_en = ?, whatsapp_appointment_reminder_ar = ?,
          whatsapp_clinical_followup_en = ?, whatsapp_clinical_followup_ar = ?,
          whatsapp_financial_followup_en = ?, whatsapp_financial_followup_ar = ?,
          updated_at = datetime('now')
         WHERE id = ?`)
            .run(merged.clinicName ?? null, merged.clinicPhone ?? null, merged.doctorPhone ?? null, merged.address ?? null, merged.logoPath ?? null, merged.logoOriginalName ?? null, merged.workingDays, merged.workStartTime, merged.workEndTime, merged.whatsappMessageLanguage ?? 'en', merged.whatsappAppointmentReminderEn ?? null, merged.whatsappAppointmentReminderAr ?? null, merged.whatsappClinicalFollowupEn ?? null, merged.whatsappClinicalFollowupAr ?? null, merged.whatsappFinancialFollowupEn ?? null, merged.whatsappFinancialFollowupAr ?? null, SETTINGS_ID);
        return this.get();
    }
};
exports.ClinicSettingsRepository = ClinicSettingsRepository;
exports.ClinicSettingsRepository = ClinicSettingsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ClinicSettingsRepository);
//# sourceMappingURL=clinic-settings.repository.js.map