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

import { OnlineOnlyAiRoute } from '@/routes/OnlineOnlyAiRoute';

import { SubscriptionGate } from '@/routes/SubscriptionGate';

import { SubscriptionStatusPage } from '@/pages/SubscriptionStatusPage';

import { DibNovaAdminPage } from '@/pages/DibNovaAdminPage';
import { AdminOverviewPage } from '@/pages/admin/AdminOverviewPage';
import { AdminClinicsPage } from '@/pages/admin/AdminClinicsPage';
import { AdminSubscriptionPage } from '@/pages/admin/AdminSubscriptionPage';
import { AdminPaymentsPage } from '@/pages/admin/AdminPaymentsPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminOperationsPage } from '@/pages/admin/AdminOperationsPage';
import { AdminTrialsPage } from '@/pages/admin/AdminTrialsPage';
import { AdminMarketingPage } from '@/pages/admin/AdminMarketingPage';
import { AdminOfflineLicensesPage } from '@/pages/admin/AdminOfflineLicensesPage';
import { AdminAiUsagePage } from '@/pages/admin/AdminAiUsagePage';
import { AdminHistoryPage } from '@/pages/admin/AdminHistoryPage';
import { AdminAuditPage } from '@/pages/admin/AdminAuditPage';

import { OdontogramPreviewPage } from '@/pages/OdontogramPreviewPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { OnlineStatusBanner } from '@/components/common/OnlineStatusBanner';
import { PwaInstallBanner } from '@/components/common/PwaInstallBanner';
import { useAuthStore } from '@/store/auth.store';
import { defaultLandingPath } from '@/utils/landingPath';
import { useQuery } from '@tanstack/react-query';
import { installationApi } from '@/api/installation.api';

function FallbackRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const { data: installStatus } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
    staleTime: 60_000,
  });
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return (
    <Navigate
      to={defaultLandingPath(user?.permissions, installStatus?.deploymentMode)}
      replace
    />
  );
}

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

          <Route path="/dibnova-admin" element={<DibNovaAdminPage />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="clinics" element={<AdminClinicsPage />} />
            <Route path="subscription" element={<AdminSubscriptionPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="operations" element={<AdminOperationsPage />} />
            <Route path="trials" element={<AdminTrialsPage />} />
            <Route path="marketing" element={<AdminMarketingPage />} />
            <Route path="offline-licenses" element={<AdminOfflineLicensesPage />} />
            <Route path="ai-usage" element={<AdminAiUsagePage />} />
            <Route path="history" element={<AdminHistoryPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
            <Route path="*" element={<Navigate to="/dibnova-admin" replace />} />
          </Route>

          <Route path="/login" element={<LoginPage />} />

          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

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
                <Route path="/patients/:id/prescription/xray/:rxId" element={<XrayPrescriptionBuilderPage />} />

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

                <Route path="/ai-assistant" element={<OnlineOnlyAiRoute />} />

              </Route>

            </Route>

          </Route>



          <Route path="/home" element={<FallbackRedirect />} />

          <Route path="/patients" element={<FallbackRedirect />} />

          <Route path="*" element={<FallbackRedirect />} />

        </Routes>

        </SubscriptionGate>

      </InstallationGate>

    </BrowserRouter>

  );

}


