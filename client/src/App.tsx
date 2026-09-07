import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';

import { ProtectedRoute } from '@/routes/ProtectedRoute';

import { InstallationGate } from '@/routes/InstallationGate';

import { PERMISSIONS } from '@/constants/permissions';

import { LoginPage } from '@/pages/LoginPage';

import { ActivationPage } from '@/pages/ActivationPage';

import { FirstSetupPage } from '@/pages/FirstSetupPage';

import { ServerConfigPage } from '@/pages/ServerConfigPage';

import { PatientRecordPage } from '@/pages/PatientRecordPage';

import { PrescriptionBuilderPage } from '@/pages/PrescriptionBuilderPage';

import { XrayPrescriptionBuilderPage } from '@/pages/XrayPrescriptionBuilderPage';

import { AppointmentsPage } from '@/pages/AppointmentsPage';

import { ReportsPage } from '@/pages/ReportsPage';

import { SettingsPage } from '@/pages/SettingsPage';

import { FollowUpPage } from '@/pages/FollowUpPage';

import { DailyReportPage } from '@/pages/DailyReportPage';

import { LabCasesPage } from '@/pages/LabCasesPage';

import { LabAccountPage } from '@/pages/LabAccountPage';

import { ClinicExpensesPage } from '@/pages/ClinicExpensesPage';

import { AiAssistantPage } from '@/pages/AiAssistantPage';

import { SubscriptionGate } from '@/routes/SubscriptionGate';

import { SubscriptionStatusPage } from '@/pages/SubscriptionStatusPage';

import { DibNovaAdminPage } from '@/pages/DibNovaAdminPage';

import { OdontogramPreviewPage } from '@/pages/OdontogramPreviewPage';
import { OnlineStatusBanner } from '@/components/common/OnlineStatusBanner';
import { PwaInstallBanner } from '@/components/common/PwaInstallBanner';

export default function App() {

  return (

    <BrowserRouter>
      <OnlineStatusBanner />
      <PwaInstallBanner />

      <InstallationGate>

        <SubscriptionGate>

        <Routes>

          <Route path="/server-config" element={<ServerConfigPage />} />

          <Route path="/activate" element={<ActivationPage />} />

          <Route path="/setup" element={<FirstSetupPage />} />

          <Route path="/subscription-status" element={<SubscriptionStatusPage />} />

          <Route path="/dibnova-admin" element={<DibNovaAdminPage />} />

          <Route path="/login" element={<LoginPage />} />

          <Route path="/odontogram-preview" element={<OdontogramPreviewPage />} />



          <Route element={<ProtectedRoute />}>

            <Route element={<AppShell />}>

              <Route element={<ProtectedRoute permission={PERMISSIONS.PATIENTS_VIEW} />}>

                <Route path="/" element={<PatientRecordPage />} />

                <Route path="/patients/:id" element={<PatientRecordPage />} />

              </Route>



              <Route element={<ProtectedRoute permission={PERMISSIONS.PRESCRIPTIONS_MANAGE} />}>

                <Route path="/patients/:id/prescription/new" element={<PrescriptionBuilderPage />} />

                <Route path="/patients/:id/prescription/xray/new" element={<XrayPrescriptionBuilderPage />} />

              </Route>



              <Route element={<ProtectedRoute permission={PERMISSIONS.APPOINTMENTS_VIEW} />}>

                <Route path="/appointments" element={<AppointmentsPage />} />

              </Route>



              <Route element={<ProtectedRoute permission={PERMISSIONS.FOLLOWUPS_MANAGE} />}>

                <Route path="/follow-ups" element={<FollowUpPage />} />

              </Route>



              <Route element={<ProtectedRoute permission={PERMISSIONS.LAB_CASES_MANAGE} />}>

                <Route path="/lab-cases" element={<LabCasesPage />} />

                <Route path="/lab-accounts" element={<LabAccountPage />} />

                <Route path="/lab-accounts/:id" element={<LabAccountPage />} />

              </Route>



              <Route element={<ProtectedRoute permission={PERMISSIONS.REPORTS_VIEW} />}>

                <Route path="/clinic-expenses" element={<ClinicExpensesPage />} />

                <Route path="/reports" element={<ReportsPage />} />

                <Route path="/daily-report" element={<DailyReportPage />} />

              </Route>



              <Route element={<ProtectedRoute permission={PERMISSIONS.SETTINGS_VIEW} />}>

                <Route path="/settings" element={<SettingsPage />} />

              </Route>



              <Route element={<ProtectedRoute permission={PERMISSIONS.AI_ASSISTANT_USE} />}>

                <Route path="/ai-assistant" element={<AiAssistantPage />} />

              </Route>

            </Route>

          </Route>



          <Route path="/home" element={<Navigate to="/" replace />} />

          <Route path="/patients" element={<Navigate to="/" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>

        </SubscriptionGate>

      </InstallationGate>

    </BrowserRouter>

  );

}


