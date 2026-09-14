import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { syncApi } from '@/api/sync.api';
import { useClinicAutoSync } from '@/hooks/useClinicAutoSync';

export function ClinicSyncChip() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useClinicAutoSync();
  const { data } = useQuery({
    queryKey: ['clinic-sync-status'],
    queryFn: syncApi.status,
    enabled: isAuthenticated,
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  if (!isAuthenticated || !data || data.kind === 'none' || !data.paired) return null;

  const label = t(`settings.clinicSync.states.${data.state}`);
  const tone =
    data.state === 'SYNCING'
      ? 'syncing'
      : data.state === 'CONFLICT'
        ? 'conflict'
        : data.state === 'PENDING'
          ? 'pending'
          : data.state === 'OFFLINE' || data.state === 'ERROR'
            ? 'offline'
            : 'online';
  return (
    <span className={`connection-status-chip connection-status-chip--${tone}`} title={data.lastError || label}>
      <span className="connection-status-chip__dot" aria-hidden />
      {label}
    </span>
  );
}
