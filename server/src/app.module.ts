import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { TreatmentsModule } from './treatments/treatments.module';
import { PaymentsModule } from './payments/payments.module';
import { AccountDiscountsModule } from './account-discounts/account-discounts.module';
import { SettingsModule } from './settings/settings.module';
import { ReportsModule } from './reports/reports.module';
import { PatientAttachmentsModule } from './attachments/patient-attachments.module';
import { SyncModule } from './sync/sync.module';
import { ExpensesModule } from './expenses/expenses.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { BackupModule } from './backup/backup.module';

import { LabCasesModule } from './lab-cases/lab-cases.module';
import { AuditModule } from './audit/audit.module';
import { ClinicalModule } from './clinical/clinical.module';

import { InstallationModule } from './installation/installation.module';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { DibNovaAdminModule } from './dibnova-admin/dibnova-admin.module';
import { UpdatesModule } from './updates/updates.module';
import { OfflineLicensingModule } from './offline-licensing/offline-licensing.module';
import { PlatformModule } from './platform/platform.module';
import { TenantMiddleware } from './platform/tenant.middleware';
import { IdempotencyModule } from './common/idempotency.module';

/** Resolve server/.env whether npm is started from repo root or server/. */
function resolveServerEnvFile(): string {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'server', '.env'),
    path.resolve(__dirname, '..', '.env'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: resolveServerEnvFile() }),
    PlatformModule,
    DatabaseModule,
    IdempotencyModule,
    InstallationModule,    AuditModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    TreatmentsModule,
    PaymentsModule,
    AccountDiscountsModule,
    SettingsModule,
    ReportsModule,
    PatientAttachmentsModule,
    SyncModule,
    ExpensesModule,
    PrescriptionsModule,
    FollowUpsModule,
    BackupModule,
    LabCasesModule,
    ClinicalModule,
    AiAssistantModule,
    SubscriptionModule,
    DibNovaAdminModule,
    UpdatesModule,
    OfflineLicensingModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
