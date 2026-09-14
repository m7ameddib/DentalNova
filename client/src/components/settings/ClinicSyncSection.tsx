import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Unplug } from 'lucide-react';
import { syncApi } from '@/api/sync.api';
import { getErrorMessage } from '@/utils/errors';

export function ClinicSyncSection({ mode }: { mode: 'online' | 'offline' }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [onlineUrl, setOnlineUrl] = useState('https://dentalnova.dibnova.com');
  const [pairingCode, setPairingCode] = useState('');

  const { data: status, refetch } = useQuery({
    queryKey: ['clinic-sync-status'],
    queryFn: syncApi.status,
    refetchInterval: 15_000,
  });

  const { data: conflicts = [] } = useQuery({
    queryKey: ['clinic-sync-conflicts'],
    queryFn: syncApi.conflicts,
    refetchInterval: 20_000,
  });

  const pairingMutation = useMutation({
    mutationFn: syncApi.startPairing,
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
    onSuccess: () => setError(null),
  });

  const connectMutation = useMutation({
    mutationFn: () => syncApi.connect(onlineUrl, pairingCode),
    onSuccess: async () => {
      setSuccess(t('settings.clinicSync.connected'));
      await syncApi.bootstrap().catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: ['clinic-sync-status'] });
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const syncNowMutation = useMutation({
    mutationFn: syncApi.syncNow,
    onSuccess: () => {
      setSuccess(t('settings.clinicSync.syncComplete'));
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function onConnect(e: FormEvent) {
    e.preventDefault();
    setError(null);
    connectMutation.mutate();
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.clinicSync.title')}</h2>
      <p className="muted">{t('settings.clinicSync.subtitle')}</p>
      <p className="muted">{t('settings.clinicSync.notBackup')}</p>
      {mode === 'offline' && <p className="muted">{t('settings.clinicSync.emptyOnly')}</p>}

      {status && (
        <dl className="updates-info-grid">
          <div>
            <dt>{t('settings.clinicSync.state')}</dt>
            <dd>{status.state}</dd>
          </div>
          <div>
            <dt>{t('settings.clinicSync.pending')}</dt>
            <dd>{status.pendingOutbound}</dd>
          </div>
          <div>
            <dt>{t('settings.clinicSync.conflicts')}</dt>
            <dd>{status.conflicts}</dd>
          </div>
          <div>
            <dt>{t('settings.clinicSync.lastSynced')}</dt>
            <dd>{status.lastSyncedAt || '—'}</dd>
          </div>
        </dl>
      )}
      {status?.lastError ? <div className="form-error-banner">{status.lastError}</div> : null}

      {mode === 'online' && (
        <div className="settings-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => pairingMutation.mutate()}
            disabled={pairingMutation.isPending}
          >
            {t('settings.clinicSync.createCode')}
          </button>
          {pairingMutation.data && (
            <p>
              {t('settings.clinicSync.codeLabel')}: <strong>{pairingMutation.data.code}</strong>
              <br />
              <span className="muted">{t('settings.clinicSync.codeExpires', { at: pairingMutation.data.expiresAt })}</span>
            </p>
          )}
        </div>
      )}

      {mode === 'offline' && !status?.paired && (
        <form className="setup-grid" onSubmit={onConnect} style={{ marginTop: 16 }}>
          <label className="form-field setup-grid__full">
            <span className="form-field__label">{t('settings.clinicSync.onlineUrl')}</span>
            <input value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} required />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('settings.clinicSync.pairingCode')}</span>
            <input value={pairingCode} onChange={(e) => setPairingCode(e.target.value.toUpperCase())} required />
          </label>
          <button className="btn btn--primary" type="submit" disabled={connectMutation.isPending}>
            {t('settings.clinicSync.connect')}
          </button>
        </form>
      )}

      <div className="settings-actions" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button type="button" className="btn" onClick={() => syncNowMutation.mutate()} disabled={syncNowMutation.isPending}>
          <RefreshCw size={14} /> {t('settings.clinicSync.syncNow')}
        </button>
        {mode === 'offline' && status?.paired && (
          <button
            type="button"
            className="btn"
            onClick={() =>
              syncApi.disconnect().then(() => {
                void refetch();
              })
            }
          >
            <Unplug size={14} /> {t('settings.clinicSync.disconnect')}
          </button>
        )}
      </div>

      {mode === 'online' && (status?.devices?.length ?? 0) > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>{t('settings.clinicSync.devices')}</h3>
          <ul>
            {(status?.devices ?? []).map((device) => (
              <li key={device.id}>
                {device.name} {device.revokedAt ? `(${t('settings.clinicSync.revoked')})` : ''}
                {!device.revokedAt && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => syncApi.revokeDevice(device.id).then(() => refetch())}
                  >
                    {t('settings.clinicSync.revoke')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {conflicts.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>{t('settings.clinicSync.conflictList')}</h3>
          <ul>
            {conflicts.map((c) => (
              <li key={c.conflictId}>
                {c.entity} — {c.reason}
                {!c.resolvedAt && (
                  <span>
                    {' '}
                    <button type="button" className="link-btn" onClick={() => syncApi.resolveConflict(c.conflictId, 'keep_local').then(() => refetch())}>
                      {t('settings.clinicSync.keepLocal')}
                    </button>
                    {' '}
                    <button type="button" className="link-btn" onClick={() => syncApi.resolveConflict(c.conflictId, 'keep_remote').then(() => refetch())}>
                      {t('settings.clinicSync.keepRemote')}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="form-error-banner">{error}</div>}
      {success && <p className="muted">{success}</p>}
    </section>
  );
}
