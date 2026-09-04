"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_module_1 = require("./database/database.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const patients_module_1 = require("./patients/patients.module");
const appointments_module_1 = require("./appointments/appointments.module");
const treatments_module_1 = require("./treatments/treatments.module");
const payments_module_1 = require("./payments/payments.module");
const settings_module_1 = require("./settings/settings.module");
const reports_module_1 = require("./reports/reports.module");
const patient_attachments_module_1 = require("./attachments/patient-attachments.module");
const sync_module_1 = require("./sync/sync.module");
const expenses_module_1 = require("./expenses/expenses.module");
const prescriptions_module_1 = require("./prescriptions/prescriptions.module");
const follow_ups_module_1 = require("./follow-ups/follow-ups.module");
const backup_module_1 = require("./backup/backup.module");
const lab_cases_module_1 = require("./lab-cases/lab-cases.module");
const audit_module_1 = require("./audit/audit.module");
const clinical_module_1 = require("./clinical/clinical.module");
const installation_module_1 = require("./installation/installation.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            database_module_1.DatabaseModule,
            installation_module_1.InstallationModule, audit_module_1.AuditModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            patients_module_1.PatientsModule,
            appointments_module_1.AppointmentsModule,
            treatments_module_1.TreatmentsModule,
            payments_module_1.PaymentsModule,
            settings_module_1.SettingsModule,
            reports_module_1.ReportsModule,
            patient_attachments_module_1.PatientAttachmentsModule,
            sync_module_1.SyncModule,
            expenses_module_1.ExpensesModule,
            prescriptions_module_1.PrescriptionsModule,
            follow_ups_module_1.FollowUpsModule,
            backup_module_1.BackupModule,
            lab_cases_module_1.LabCasesModule,
            clinical_module_1.ClinicalModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map