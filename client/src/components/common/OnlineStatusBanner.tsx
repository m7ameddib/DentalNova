import { WifiOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';
import { retryFailedOutbox } from '@/offline/sync';
import { syncWhenOnline } from '@/offline/intercept';
import { useOfflineStatusStore } from '@/offline/status.store';

export function OnlineStatusBanner() {
  const { t } = useTranslation();
  const enabled = useOfflineStatusStore((s) => s.enabled);
  const connection = useOfflineStatusStore((s) => s.connection);
  const pending = useOfflineStatusStore((s) => s.pending);
  const conflicts = useOfflineStatusStore((s) => s.conflicts);
  const needsReauth = useOfflineStatusStore((s) => s.needsReauth);

  const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const showOffline = connection === 'offline' && browserOffline;

  if (!enabled) {
    return null;
  }

  if (!showOffline && connection !== 'syncing' && pending === 0 && conflicts === 0 && !needsReauth) {
    return null;
  }

  const message = needsReauth
    ? t('offlineFallback.reauth')
    : connection === 'syncing'
      ? t('offlineFallback.syncing', { count: pending })
      : pending > 0
        ? t(showOffline ? 'offlineFallback.offlinePending' : 'offlineFallback.onlinePending', {
            count: pending,
          })
        : showOffline
          ? t('offlineFallback.offline')
          : null;

  const pendingOnline = !showOffline;

  return (
    <div
      className={
        connection === 'syncing' || pendingOnline
          ? 'online-status-banner online-status-banner--syncing'
          : 'online-status-banner'
      }
      role="status"
    >
      {connection === 'syncing' || pendingOnline ? (
        <RefreshCw size={14} aria-hidden />
      ) : (
        <WifiOff size={14} aria-hidden />
      )}
      {message ? <span>{message}</span> : null}
      {conflicts > 0 && <span>{t('offlineFallback.conflicts', { count: conflicts })}</span>}
      {(pending > 0 || conflicts > 0) && connection !== 'syncing' && !needsReauth && (
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            void retryFailedOutbox().then(() => syncWhenOnline(apiClient));
          }}
        >
          {t('offlineFallback.retrySync')}
        </button>
      )}
    </div>
  );
}
