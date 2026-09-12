import { useTranslation } from 'react-i18next';
import { useOfflineStatusStore } from '@/offline/status.store';

export function ConnectionStatusChip() {
  const { t } = useTranslation();
  const enabled = useOfflineStatusStore((s) => s.enabled);
  const connection = useOfflineStatusStore((s) => s.connection);
  const pending = useOfflineStatusStore((s) => s.pending);

  if (!enabled) return null;

  const label =
    connection === 'syncing'
      ? t('offlineFallback.chipSyncing')
      : connection === 'offline'
        ? t('offlineFallback.chipOffline')
        : t('offlineFallback.chipOnline');

  return (
    <span
      className={`connection-status-chip connection-status-chip--${connection}`}
      title={pending > 0 ? t('offlineFallback.offlinePending', { count: pending }) : label}
    >
      <span className="connection-status-chip__dot" aria-hidden />
      {label}
    </span>
  );
}
