import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { syncApi } from '@/api/sync.api';

export function ClinicSyncChip() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data } = useQuery({
    queryKey: ['clinic-sync-status'],
    queryFn: syncApi.status,
    enabled: isAuthenticated,
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  if (!isAuthenticated || !data || data.kind === 'none' || !data.paired) return null;

  const label = data.state;
  const tone =
    data.state === 'SYNCING'
      ? 'syncing'
      : data.state === 'CONFLICT'
        ? 'conflict'
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
