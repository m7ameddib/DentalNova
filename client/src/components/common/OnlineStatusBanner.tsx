import { WifiOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOfflineStatusStore } from '@/offline/status.store';

export function OnlineStatusBanner() {
  const { t } = useTranslation();
  const enabled = useOfflineStatusStore((s) => s.enabled);
  const connection = useOfflineStatusStore((s) => s.connection);
  const pending = useOfflineStatusStore((s) => s.pending);
  const conflicts = useOfflineStatusStore((s) => s.conflicts);
  const needsReauth = useOfflineStatusStore((s) => s.needsReauth);

  if (!enabled) {
    return null;
  }

  if (connection === 'online' && pending === 0 && conflicts === 0 && !needsReauth) {
    return null;
  }

  const message = needsReauth
    ? t('offlineFallback.reauth')
    : connection === 'syncing'
      ? t('offlineFallback.syncing', { count: pending })
      : pending > 0
        ? t('offlineFallback.offlinePending', { count: pending })
        : t('offlineFallback.offline');

  return (
    <div
      className={
        connection === 'syncing'
          ? 'online-status-banner online-status-banner--syncing'
          : 'online-status-banner'
      }
      role="status"
    >
      {connection === 'syncing' ? <RefreshCw size={14} aria-hidden /> : <WifiOff size={14} aria-hidden />}
      <span>{message}</span>
      {conflicts > 0 && <span>{t('offlineFallback.conflicts', { count: conflicts })}</span>}
    </div>
  );
}
