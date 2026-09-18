import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dibnovaAdminApi,
  type AdminAiUsage,
  type AdminAuditEvent,
  type AdminClinicInfo,
  type AdminClinicOps,
  type AdminClinicUser,
  type AdminLicensePayment,
  type AdminManagedClinic,
  type AdminOpsHealth,
  type OfflineLicenseSlotSummary,
} from '@/api/dibnova-admin.api';
import type { OnlineSubscriptionStatus } from '@/api/subscription.api';
import { getErrorMessage } from '@/utils/errors';
import { todayIso } from '@/utils/date';
import { DIBNOVA_LOGIN_URL, DIBNOVA_WHATSAPP_PHONE } from '@/constants/dibnova-contact';
import { openWhatsApp } from '@/utils/whatsapp';

interface CreatedMarketing {
  clinicId: string;
  username: string;
  password: string;
  phone: string;
}

interface AdminDashboardContextValue {
  notes: string;
  setNotes: (value: string) => void;
  error: string | null;
  success: string | null;
  setError: (value: string | null) => void;
  setSuccess: (value: string | null) => void;
  selectedClinicId: string;
  setSelectedClinicId: (value: string) => void;
  clinicQuery: string;
  setClinicQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  renewDays: string;
  setRenewDays: (value: string) => void;
  renewDate: string;
  setRenewDate: (value: string) => void;
  payAmount: string;
  setPayAmount: (value: string) => void;
  payDate: string;
  setPayDate: (value: string) => void;
  payMethod: string;
  setPayMethod: (value: string) => void;
  payNote: string;
  setPayNote: (value: string) => void;
  resetUserId: number | null;
  setResetUserId: (value: number | null) => void;
  resetPassword: string;
  setResetPassword: (value: string) => void;
  marketingDoctor: string;
  setMarketingDoctor: (value: string) => void;
  marketingPhone: string;
  setMarketingPhone: (value: string) => void;
  createdMarketing: CreatedMarketing | null;
  offlineClinicId: string;
  setOfflineClinicId: (value: string) => void;
  offlineClinicName: string;
  setOfflineClinicName: (value: string) => void;
  offlineInstallationId: string;
  setOfflineInstallationId: (value: string) => void;
  generatedCode: string | null;
  signupInvite: string | null;
  codeCopied: boolean;
  data: AdminClinicInfo | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  isOnline: boolean;
  canIssueOfflineLicenses: boolean;
  onlineClinics: AdminManagedClinic[];
  selectedClinic: AdminManagedClinic | null;
  clinicReady: boolean;
  effectiveStatus: OnlineSubscriptionStatus | null;
  filteredClinics: AdminManagedClinic[];
  offlineSlots: OfflineLicenseSlotSummary[] | undefined;
  dashboard:
    | { total: number; counts: Record<string, number>; clinics: AdminManagedClinic[] }
    | undefined;
  trialRequests: AdminManagedClinic[];
  payments: AdminLicensePayment[];
  history: Record<string, unknown>[];
  clinicUsers: AdminClinicUser[];
  payBalance: { balanceCents: number } | undefined;
  opsHealth: AdminOpsHealth | undefined;
  clinicOps: AdminClinicOps | undefined;
  aiUsage: AdminAiUsage[];
  auditEvents: AdminAuditEvent[];
  actionPending: boolean;
  activateTrialPending: boolean;
  marketingPending: boolean;
  createOfflinePending: boolean;
  invalidate: () => void;
  confirmAction: (messageKey: string, vars?: Record<string, string>) => boolean;
  mutateAction: (action: 'activate' | 'extend' | 'suspend' | 'reactivate') => void;
  mutateActivateTrial: (clinicId: string) => void;
  mutateMarketing: () => void;
  mutateCreateOfflineSlot: () => void;
  handleCopyGeneratedCode: () => Promise<void>;
  createSignupInvite: () => void;
  sendTrialWhatsApp: (phone: string, username: string, password: string) => void;
}

const AdminDashboardContext = createContext<AdminDashboardContextValue | null>(null);

export function AdminDashboardProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [clinicQuery, setClinicQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [renewDays, setRenewDays] = useState('365');
  const [renewDate, setRenewDate] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayIso());
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNote, setPayNote] = useState('');
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [marketingDoctor, setMarketingDoctor] = useState('');
  const [marketingPhone, setMarketingPhone] = useState('');
  const [createdMarketing, setCreatedMarketing] = useState<CreatedMarketing | null>(null);
  const [offlineClinicId, setOfflineClinicId] = useState('');
  const [offlineClinicName, setOfflineClinicName] = useState('');
  const [offlineInstallationId, setOfflineInstallationId] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [signupInvite, setSignupInvite] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['dibnova-admin-installation'],
    queryFn: dibnovaAdminApi.getInstallation,
    retry: false,
  });

  useEffect(() => {
    if (!data?.clinics?.length) return;
    if (!selectedClinicId || !data.clinics.some((clinic) => clinic.clinicId === selectedClinicId)) {
      setSelectedClinicId(data.clinics[0].clinicId);
    }
  }, [data, selectedClinicId]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-installation'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-trials'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-audit'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-ops-health'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-history'] });
    queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
    queryClient.invalidateQueries({ queryKey: ['installation-status'] });
  }, [queryClient]);

  const isOnline = data?.deploymentMode === 'online';
  const canIssueOfflineLicenses = Boolean(data?.offlineLicensing?.canIssueOfflineLicenses);
  const onlineClinics = data?.clinics ?? [];
  const selectedClinic =
    onlineClinics.find((clinic) => clinic.clinicId === selectedClinicId) ?? onlineClinics[0] ?? null;
  const clinicReady = Boolean(selectedClinic) || (!isOnline && data?.phase === 'ready');
  const effectiveStatus: OnlineSubscriptionStatus | null = selectedClinic
    ? selectedClinic.subscription.status
    : clinicReady
      ? (data?.subscription.status ?? 'PENDING')
      : null;

  const { data: offlineSlots } = useQuery({
    queryKey: ['dibnova-admin-offline-slots'],
    queryFn: dibnovaAdminApi.listOfflineLicenseSlots,
    enabled: canIssueOfflineLicenses,
  });

  const { data: dashboard } = useQuery({
    queryKey: ['dibnova-admin-dashboard'],
    queryFn: dibnovaAdminApi.dashboard,
    enabled: isOnline,
  });

  const { data: trialRequests = [] } = useQuery({
    queryKey: ['dibnova-admin-trials'],
    queryFn: dibnovaAdminApi.listTrials,
    enabled: isOnline,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['dibnova-admin-payments', selectedClinicId],
    queryFn: () => dibnovaAdminApi.listPayments(selectedClinicId || undefined),
    enabled: isOnline && Boolean(selectedClinicId),
  });

  const { data: history = [] } = useQuery({
    queryKey: ['dibnova-admin-history', selectedClinicId],
    queryFn: () => dibnovaAdminApi.history(selectedClinicId || undefined),
    enabled: isOnline && Boolean(selectedClinicId),
  });

  const { data: clinicUsers = [] } = useQuery({
    queryKey: ['dibnova-admin-users', selectedClinicId],
    queryFn: () => dibnovaAdminApi.listClinicUsers(selectedClinicId),
    enabled: isOnline && Boolean(selectedClinicId),
  });

  const { data: payBalance } = useQuery({
    queryKey: ['dibnova-admin-balance', selectedClinicId],
    queryFn: () => dibnovaAdminApi.paymentBalance(selectedClinicId),
    enabled: isOnline && Boolean(selectedClinicId),
  });

  const { data: opsHealth } = useQuery({
    queryKey: ['dibnova-admin-ops-health'],
    queryFn: dibnovaAdminApi.opsHealth,
    enabled: isOnline,
  });

  const { data: clinicOps } = useQuery({
    queryKey: ['dibnova-admin-clinic-ops', selectedClinicId],
    queryFn: () => dibnovaAdminApi.clinicOps(selectedClinicId),
    enabled: isOnline && Boolean(selectedClinicId),
  });

  const { data: aiUsage = [] } = useQuery({
    queryKey: ['dibnova-admin-ai-usage'],
    queryFn: () => dibnovaAdminApi.aiUsage(),
    enabled: isOnline,
  });

  const { data: auditEvents = [] } = useQuery({
    queryKey: ['dibnova-admin-audit', selectedClinicId],
    queryFn: () => dibnovaAdminApi.audit(selectedClinicId || undefined),
    enabled: isOnline,
  });

  const actionMutation = useMutation({
    mutationFn: async (action: 'activate' | 'extend' | 'suspend' | 'reactivate') => {
      const clinicId = selectedClinicId || undefined;
      switch (action) {
        case 'activate':
          return dibnovaAdminApi.activate(notes, clinicId, Number(renewDays) || undefined, renewDate || undefined);
        case 'extend':
          return dibnovaAdminApi.extend(notes, clinicId, Number(renewDays) || undefined, renewDate || undefined);
        case 'suspend':
          return dibnovaAdminApi.suspend(notes, clinicId);
        case 'reactivate':
          return dibnovaAdminApi.reactivate(notes, clinicId);
      }
    },
    onSuccess: (_result, action) => {
      setSuccess(t(`dibnovaAdmin.success.${action}`));
      setError(null);
      setNotes('');
      invalidate();
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const createOfflineSlotMutation = useMutation({
    mutationFn: () =>
      dibnovaAdminApi.createOfflineLicenseSlot({
        clinicId: offlineClinicId.trim(),
        clinicName: offlineClinicName.trim(),
        installationId: offlineInstallationId.trim() || undefined,
        adminNotes: notes.trim() || undefined,
      }),
    onSuccess: (result) => {
      setGeneratedCode(result.activationCode);
      setCodeCopied(false);
      setSuccess(t('dibnovaAdmin.success.createOfflineSlot'));
      setError(null);
      setOfflineClinicId('');
      setOfflineClinicName('');
      setOfflineInstallationId('');
      setNotes('');
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const activateTrialMutation = useMutation({
    mutationFn: (clinicId: string) => dibnovaAdminApi.activateTrial(clinicId, notes),
    onSuccess: () => {
      setSuccess(t('dibnovaAdmin.success.activateTrial'));
      setError(null);
      invalidate();
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const marketingMutation = useMutation({
    mutationFn: () => dibnovaAdminApi.createMarketingTrial(marketingDoctor.trim(), marketingPhone.trim()),
    onSuccess: (result) => {
      setCreatedMarketing({
        clinicId: result.clinicId,
        username: result.username,
        password: result.password,
        phone: result.phone,
      });
      setSelectedClinicId(result.clinicId);
      setMarketingDoctor('');
      setMarketingPhone('');
      setSuccess(t('dibnovaAdmin.success.createMarketingTrial'));
      setError(null);
      invalidate();
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const confirmAction = useCallback(
    (messageKey: string, vars?: Record<string, string>): boolean => {
      return window.confirm(t(messageKey, vars));
    },
    [t],
  );

  const handleCopyGeneratedCode = useCallback(async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCodeCopied(true);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = generatedCode;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCodeCopied(true);
    }
  }, [generatedCode]);

  const sendTrialWhatsApp = useCallback(
    (phone: string, username: string, password: string) => {
      const sent = openWhatsApp(
        phone || DIBNOVA_WHATSAPP_PHONE,
        t('dibnovaAdmin.trialWhatsAppMessage', {
          url: DIBNOVA_LOGIN_URL,
          username,
          password,
        }),
      );
      if (!sent) setError(t('dibnovaAdmin.trialWhatsAppMissingPhone'));
    },
    [t],
  );

  const createSignupInvite = useCallback(() => {
    void dibnovaAdminApi
      .createSignupInvite()
      .then((r) => {
        setSignupInvite(r.token);
        setSuccess(t('dibnovaAdmin.success.signupInvite'));
      })
      .catch((err) => setError(getErrorMessage(err, t('common.error'))));
  }, [t]);

  const filteredClinics = useMemo(
    () =>
      onlineClinics.filter((clinic) => {
        const q = clinicQuery.trim().toLowerCase();
        const matchesQuery =
          !q ||
          clinic.clinicName.toLowerCase().includes(q) ||
          clinic.clinicId.toLowerCase().includes(q) ||
          (clinic.clinicPhone ?? '').includes(q);
        const matchesStatus = statusFilter === 'ALL' || clinic.subscription.status === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [clinicQuery, onlineClinics, statusFilter],
  );

  const value = useMemo<AdminDashboardContextValue>(
    () => ({
      notes,
      setNotes,
      error,
      success,
      setError,
      setSuccess,
      selectedClinicId,
      setSelectedClinicId,
      clinicQuery,
      setClinicQuery,
      statusFilter,
      setStatusFilter,
      renewDays,
      setRenewDays,
      renewDate,
      setRenewDate,
      payAmount,
      setPayAmount,
      payDate,
      setPayDate,
      payMethod,
      setPayMethod,
      payNote,
      setPayNote,
      resetUserId,
      setResetUserId,
      resetPassword,
      setResetPassword,
      marketingDoctor,
      setMarketingDoctor,
      marketingPhone,
      setMarketingPhone,
      createdMarketing,
      offlineClinicId,
      setOfflineClinicId,
      offlineClinicName,
      setOfflineClinicName,
      offlineInstallationId,
      setOfflineInstallationId,
      generatedCode,
      signupInvite,
      codeCopied,
      data,
      isLoading,
      isError,
      refetch: () => {
        void refetch();
      },
      isOnline,
      canIssueOfflineLicenses,
      onlineClinics,
      selectedClinic,
      clinicReady,
      effectiveStatus,
      filteredClinics,
      offlineSlots,
      dashboard,
      trialRequests,
      payments,
      history,
      clinicUsers,
      payBalance,
      opsHealth,
      clinicOps,
      aiUsage,
      auditEvents,
      actionPending: actionMutation.isPending,
      activateTrialPending: activateTrialMutation.isPending,
      marketingPending: marketingMutation.isPending,
      createOfflinePending: createOfflineSlotMutation.isPending,
      invalidate,
      confirmAction,
      mutateAction: (action) => actionMutation.mutate(action),
      mutateActivateTrial: (clinicId) => activateTrialMutation.mutate(clinicId),
      mutateMarketing: () => marketingMutation.mutate(),
      mutateCreateOfflineSlot: () => createOfflineSlotMutation.mutate(),
      handleCopyGeneratedCode,
      createSignupInvite,
      sendTrialWhatsApp,
    }),
    [
      notes,
      error,
      success,
      selectedClinicId,
      clinicQuery,
      statusFilter,
      renewDays,
      renewDate,
      payAmount,
      payDate,
      payMethod,
      payNote,
      resetUserId,
      resetPassword,
      marketingDoctor,
      marketingPhone,
      createdMarketing,
      offlineClinicId,
      offlineClinicName,
      offlineInstallationId,
      generatedCode,
      signupInvite,
      codeCopied,
      data,
      isLoading,
      isError,
      refetch,
      isOnline,
      canIssueOfflineLicenses,
      onlineClinics,
      selectedClinic,
      clinicReady,
      effectiveStatus,
      filteredClinics,
      offlineSlots,
      dashboard,
      trialRequests,
      payments,
      history,
      clinicUsers,
      payBalance,
      opsHealth,
      clinicOps,
      aiUsage,
      auditEvents,
      actionMutation,
      activateTrialMutation,
      marketingMutation,
      createOfflineSlotMutation,
      invalidate,
      confirmAction,
      handleCopyGeneratedCode,
      createSignupInvite,
      sendTrialWhatsApp,
    ],
  );

  return <AdminDashboardContext.Provider value={value}>{children}</AdminDashboardContext.Provider>;
}

export function useAdminDashboard(): AdminDashboardContextValue {
  const ctx = useContext(AdminDashboardContext);
  if (!ctx) {
    throw new Error('useAdminDashboard must be used within AdminDashboardProvider');
  }
  return ctx;
}
