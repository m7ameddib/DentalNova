import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, RefreshCw, Unplug } from 'lucide-react';
import { syncApi, type ClinicSyncDevice, type PairingPreviewResult, type PairingStartResult } from '@/api/sync.api';
import { PairingQr } from '@/components/common/PairingQr';
import { Modal } from '@/components/common/Modal';
import { getApiErrorCode, getErrorMessage } from '@/utils/errors';
import { formatDateTimeDisplay } from '@/utils/date';
import { useUiStore } from '@/store/ui.store';
import {
  buildPairingPayload,
  compactPairingCode,
  formatCountdown,
  formatPairingCodeDisplay,
  pairingSecondsLeft,
} from '@/utils/pairing-payload';

export function ClinicSyncSection({ mode }: { mode: 'online' | 'offline' }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const language = useUiStore((s) => s.language);
  const locale = language === 'ar' ? 'ar' : 'en';
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    data: status,
    refetch,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['clinic-sync-status'],
    queryFn: syncApi.status,
    refetchInterval: 15_000,
  });

  const { data: conflicts = [] } = useQuery({
    queryKey: ['clinic-sync-conflicts'],
    queryFn: syncApi.conflicts,
    refetchInterval: 20_000,
    enabled: (status?.conflicts ?? 0) > 0 || mode === 'offline',
  });

  function rememberError(err: unknown | null) {
    if (err == null) {
      setError(null);
      return;
    }
    if (getApiErrorCode(err) === 'POPULATED_OFFLINE_BLOCKED') {
      setError(t('settings.clinicSync.populatedBlocked'));
      return;
    }
    setError(getErrorMessage(err, t('settings.clinicSync.opaqueServerError')));
  }

  async function refreshSync() {
    await queryClient.invalidateQueries({ queryKey: ['clinic-sync-status'] });
    await queryClient.invalidateQueries({ queryKey: ['clinic-sync-conflicts'] });
    await refetch();
  }

  if (isLoading) {
    return (
      <section className="settings-section">
        <h2>{mode === 'offline' ? t('settings.clinicSync.navOffline') : t('settings.clinicSync.navOnline')}</h2>
        <p className="muted">{t('common.loading')}</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="settings-section">
        <h2>{mode === 'offline' ? t('settings.clinicSync.navOffline') : t('settings.clinicSync.navOnline')}</h2>
        <div className="form-error-banner">{t('settings.clinicSync.statusError')}</div>
        <button type="button" className="btn" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </section>
    );
  }

  const openConflicts = conflicts.filter((c) => !c.resolvedAt);

  return (
    <section className="settings-section clinic-sync">
      <h2>{mode === 'offline' ? t('settings.clinicSync.navOffline') : t('settings.clinicSync.navOnline')}</h2>
      <p className="muted">{mode === 'offline' ? t('settings.clinicSync.offlineSubtitle') : t('settings.clinicSync.subtitle')}</p>
      <p className="muted">{t('settings.clinicSync.notBackup')}</p>

      {status && (mode === 'offline' || status.paired) && (
        <SyncStatusCard status={status} locale={locale} />
      )}
      {status?.lastError && !error ? <div className="form-error-banner">{status.lastError}</div> : null}

      {mode === 'online' && (
        <OnlinePairingPanel
          devices={status?.devices ?? []}
          localClinicName={status?.localClinicName}
          locale={locale}
          onError={rememberError}
          onSuccess={setSuccess}
          onChanged={() => void refreshSync()}
        />
      )}

      {mode === 'offline' && (
        <OfflinePairingPanel
          paired={Boolean(status?.paired)}
          pairingBlocked={Boolean(status?.pairingBlocked)}
          needsBootstrap={Boolean(status?.needsBootstrap)}
          census={status?.census}
          peerClinicName={status?.peerClinicName}
          onlineClinicId={status?.onlineClinicId}
          onError={rememberError}
          onSuccess={setSuccess}
          onChanged={() => void refreshSync()}
        />
      )}

      {openConflicts.length > 0 && (
        <ConflictReview
          conflicts={openConflicts}
          locale={locale}
          onError={rememberError}
          onChanged={() => void refreshSync()}
        />
      )}

      {error && <div className="form-error-banner">{error}</div>}
      {success && <div className="form-success-banner">{success}</div>}
    </section>
  );
}

function SyncStatusCard({
  status,
  locale,
}: {
  status: NonNullable<Awaited<ReturnType<typeof syncApi.status>>>;
  locale: string;
}) {
  const { t } = useTranslation();
  const tone =
    status.state === 'SYNCING'
      ? 'syncing'
      : status.state === 'CONFLICT'
        ? 'conflict'
        : status.state === 'PENDING'
          ? 'pending'
          : status.state === 'OFFLINE' || status.state === 'ERROR'
            ? 'offline'
            : 'online';

  return (
    <div className="clinic-sync-status">
      <span className={`connection-status-chip connection-status-chip--${tone}`}>
        <span className="connection-status-chip__dot" aria-hidden />
        {t(`settings.clinicSync.states.${status.state}`)}
      </span>
      <dl className="updates-info-grid">
        {status.peerClinicName && (
          <div>
            <dt>{t('settings.clinicSync.clinicName')}</dt>
            <dd>{status.peerClinicName}</dd>
          </div>
        )}
        {status.onlineClinicId && (
          <div>
            <dt>{t('settings.clinicSync.clinicId')}</dt>
            <dd className="clinic-sync-mono">{status.onlineClinicId}</dd>
          </div>
        )}
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
          <dd>{status.lastSyncedAt ? formatDateTimeDisplay(status.lastSyncedAt, locale) : '—'}</dd>
        </div>
      </dl>
    </div>
  );
}

function OnlinePairingPanel({
  devices,
  localClinicName,
  locale,
  onError,
  onSuccess,
  onChanged,
}: {
  devices: ClinicSyncDevice[];
  localClinicName?: string | null;
  locale: string;
  onError: (err: unknown | null) => void;
  onSuccess: (msg: string | null) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [pairing, setPairing] = useState<PairingStartResult | null>(null);
  const [copied, setCopied] = useState<'code' | 'url' | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const clinicUrl = typeof window !== 'undefined' ? window.location.origin : pairing?.onlineUrl;

  useEffect(() => {
    if (!pairing) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [pairing]);

  const secondsLeft = pairingSecondsLeft(pairing?.expiresAt, now);
  const expired = Boolean(pairing && secondsLeft <= 0);

  const pairingMutation = useMutation({
    mutationFn: syncApi.startPairing,
    onSuccess: (data) => {
      setPairing(data);
      onError(null);
      onSuccess(null);
      setNow(Date.now());
    },
    onError: (err) => onError(err),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => syncApi.revokeDevice(id),
    onSuccess: () => {
      setRevokeId(null);
      onSuccess(t('settings.clinicSync.revokedDone'));
      onChanged();
    },
    onError: (err) => onError(err),
  });

  const activeDevices = devices.filter((d) => !d.revokedAt);
  const revokedDevices = devices.filter((d) => d.revokedAt);
  const pendingRevoke = devices.find((d) => d.id === revokeId);

  async function copy(text: string, kind: 'code' | 'url') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard may be unavailable; the code remains visible */
    }
  }

  const qrValue = pairing && clinicUrl ? buildPairingPayload(clinicUrl, pairing.code) : '';

  return (
    <div className="clinic-sync-panel">
      <h3>{t('settings.clinicSync.onlineStepsTitle')}</h3>
      <ol className="clinic-sync-steps">
        <li>{t('settings.clinicSync.onlineStep1')}</li>
        <li>{t('settings.clinicSync.onlineStep2')}</li>
        <li>{t('settings.clinicSync.onlineStep3')}</li>
      </ol>

      <dl className="clinic-sync-identity">
        <div>
          <dt>{t('settings.clinicSync.clinicName')}</dt>
          <dd>{pairing?.clinicName || localClinicName || '—'}</dd>
        </div>
        <div>
          <dt>{t('settings.clinicSync.clinicId')}</dt>
          <dd className="clinic-sync-mono">{pairing?.clinicId || '—'}</dd>
        </div>
      </dl>

      <div className="settings-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => pairingMutation.mutate()}
          disabled={pairingMutation.isPending}
        >
          {pairing ? t('settings.clinicSync.createNewCode') : t('settings.clinicSync.createCode')}
        </button>
      </div>

      {pairing && (
        <div className={expired ? 'clinic-sync-code clinic-sync-code--expired' : 'clinic-sync-code'}>
          {expired ? (
            <p className="form-error-banner">{t('settings.clinicSync.codeExpired')}</p>
          ) : (
            <>
              <p className="muted">{t('settings.clinicSync.enterOnOffline')}</p>
              <div className="clinic-sync-code__row">
                <span className="clinic-sync-code__value">{formatPairingCodeDisplay(pairing.code)}</span>
                <button type="button" className="btn" onClick={() => void copy(compactPairingCode(pairing.code), 'code')}>
                  <Copy size={14} /> {copied === 'code' ? t('settings.clinicSync.copied') : t('settings.clinicSync.copyCode')}
                </button>
              </div>
              <p className="clinic-sync-code__expiry">
                {t('settings.clinicSync.codeExpiresIn', { time: formatCountdown(secondsLeft) })}
              </p>
              <div className="clinic-sync-url">
                <span>
                  {t('settings.clinicSync.onlineUrl')}: <strong>{clinicUrl}</strong>
                </span>
                {clinicUrl && (
                  <button type="button" className="link-btn" onClick={() => void copy(clinicUrl, 'url')}>
                    {copied === 'url' ? t('settings.clinicSync.copied') : t('settings.clinicSync.copyUrl')}
                  </button>
                )}
              </div>
              {qrValue && <PairingQr value={qrValue} label={t('settings.clinicSync.qrHint')} />}
            </>
          )}
        </div>
      )}

      <h3>{t('settings.clinicSync.devices')}</h3>
      {activeDevices.length === 0 ? (
        <p className="muted">{t('settings.clinicSync.noDevices')}</p>
      ) : (
        <ul className="clinic-sync-devices">
          {activeDevices.map((device) => (
            <li key={device.id}>
              <div>
                <strong>{device.name}</strong>
                <span className="muted">
                  {device.lastSeenAt
                    ? t('settings.clinicSync.lastSeen', { at: formatDateTimeDisplay(device.lastSeenAt, locale) })
                    : t('settings.clinicSync.neverSeen')}
                </span>
              </div>
              <button type="button" className="link-btn link-btn--danger" onClick={() => setRevokeId(device.id)}>
                {t('settings.clinicSync.revoke')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {revokedDevices.length > 0 && (
        <p className="muted">
          {t('settings.clinicSync.revokedCount', { count: revokedDevices.length })}
        </p>
      )}

      {pendingRevoke && (
        <Modal title={t('settings.clinicSync.revokeTitle')} onClose={() => setRevokeId(null)}>
          <p>{t('settings.clinicSync.revokeConfirm', { name: pendingRevoke.name })}</p>
          <div className="settings-actions">
            <button type="button" className="btn" onClick={() => setRevokeId(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={revokeMutation.isPending}
              onClick={() => revokeMutation.mutate(pendingRevoke.id)}
            >
              {t('settings.clinicSync.revoke')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function OfflinePairingPanel({
  paired,
  pairingBlocked,
  needsBootstrap,
  census,
  peerClinicName,
  onlineClinicId,
  onError,
  onSuccess,
  onChanged,
}: {
  paired: boolean;
  pairingBlocked: boolean;
  needsBootstrap: boolean;
  census?: { patients: number; payments: number; treatments: number; appointments: number; total: number } | null;
  peerClinicName?: string | null;
  onlineClinicId?: string | null;
  onError: (err: unknown | null) => void;
  onSuccess: (msg: string | null) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [onlineUrl, setOnlineUrl] = useState('https://dentalnova.dibnova.com');
  const [pairingCode, setPairingCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [preview, setPreview] = useState<PairingPreviewResult | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  const previewMutation = useMutation({
    mutationFn: () => syncApi.previewConnect(onlineUrl, compactPairingCode(pairingCode)),
    onSuccess: (data) => {
      setPreview(data);
      onError(null);
      onSuccess(null);
    },
    onError: (err) => onError(err),
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      syncApi.connect(preview?.onlineUrl || onlineUrl, compactPairingCode(pairingCode), deviceName.trim() || undefined),
    onSuccess: async () => {
      setPreview(null);
      setPairingCode('');
      setBootstrapping(true);
      onSuccess(t('settings.clinicSync.connected'));
      try {
        await syncApi.bootstrap();
        onSuccess(t('settings.clinicSync.bootstrapDone'));
      } catch (err) {
        onError(err);
      } finally {
        setBootstrapping(false);
        onChanged();
      }
    },
    onError: (err) => onError(err),
  });

  const bootstrapMutation = useMutation({
    mutationFn: syncApi.bootstrap,
    onSuccess: () => {
      onSuccess(t('settings.clinicSync.bootstrapDone'));
      onChanged();
    },
    onError: (err) => onError(err),
  });

  const syncNowMutation = useMutation({
    mutationFn: syncApi.syncNow,
    onSuccess: (data) => {
      if (data?.error) {
        onError({ isAxiosError: true, response: { data: { message: data.error } } });
        onChanged();
        return;
      }
      onSuccess(t('settings.clinicSync.syncComplete'));
      onChanged();
    },
    onError: (err) => onError(err),
  });

  const disconnectMutation = useMutation({
    mutationFn: syncApi.disconnect,
    onSuccess: () => {
      setConfirmDisconnect(false);
      onSuccess(t('settings.clinicSync.disconnected'));
      onChanged();
    },
    onError: (err) => onError(err),
  });

  function onLookup(e: FormEvent) {
    e.preventDefault();
    setPreview(null);
    previewMutation.mutate();
  }

  if (pairingBlocked) {
    return (
      <div className="clinic-sync-panel">
        <div className="form-error-banner">{t('settings.clinicSync.populatedBlocked')}</div>
        {census && (
          <p className="muted">
            {t('settings.clinicSync.populatedCounts', {
              patients: census.patients,
              payments: census.payments,
              treatments: census.treatments,
              appointments: census.appointments,
            })}
          </p>
        )}
        <p className="muted">{t('settings.clinicSync.emptyOnly')}</p>
      </div>
    );
  }

  if (paired) {
    const busy = syncNowMutation.isPending || bootstrapMutation.isPending || bootstrapping;
    return (
      <div className="clinic-sync-panel">
        <p>
          {t('settings.clinicSync.pairedWith', {
            name: peerClinicName || t('settings.clinicSync.onlineClinic'),
            id: onlineClinicId || '—',
          })}
        </p>
        {needsBootstrap ? (
          <div className="form-error-banner">{t('settings.clinicSync.needsBootstrap')}</div>
        ) : (
          <p className="muted">{t('settings.clinicSync.autoSyncHint')}</p>
        )}
        <div className="settings-actions">
          {needsBootstrap ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => bootstrapMutation.mutate()}
              disabled={busy}
            >
              <RefreshCw size={14} /> {busy ? t('settings.clinicSync.syncing') : t('settings.clinicSync.finishDownload')}
            </button>
          ) : null}
          <button
            type="button"
            className={needsBootstrap ? 'btn' : 'btn btn--primary'}
            onClick={() => syncNowMutation.mutate()}
            disabled={busy}
          >
            <RefreshCw size={14} /> {busy ? t('settings.clinicSync.syncing') : t('settings.clinicSync.syncNow')}
          </button>
          <button type="button" className="btn" onClick={() => setConfirmDisconnect(true)}>
            <Unplug size={14} /> {t('settings.clinicSync.disconnect')}
          </button>
        </div>
        {confirmDisconnect && (
          <Modal title={t('settings.clinicSync.disconnect')} onClose={() => setConfirmDisconnect(false)}>
            <p>{t('settings.clinicSync.disconnectConfirm', { name: peerClinicName || t('settings.clinicSync.onlineClinic') })}</p>
            {needsBootstrap ? <p className="form-error-banner">{t('settings.clinicSync.disconnectBeforeBootstrap')}</p> : null}
            <div className="settings-actions">
              <button type="button" className="btn" onClick={() => setConfirmDisconnect(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={disconnectMutation.isPending}
                onClick={() => disconnectMutation.mutate()}
              >
                {t('settings.clinicSync.disconnect')}
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="clinic-sync-panel">
      <p className="muted">{t('settings.clinicSync.emptyOnly')}</p>
      {!preview && (
        <form className="setup-grid" onSubmit={onLookup}>
          <label className="form-field setup-grid__full">
            <span className="form-field__label">{t('settings.clinicSync.onlineUrl')}</span>
            <input
              value={onlineUrl}
              onChange={(e) => setOnlineUrl(e.target.value)}
              placeholder="https://dentalnova.dibnova.com"
              required
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('settings.clinicSync.pairingCode')}</span>
            <input
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
              autoComplete="off"
              required
              minLength={4}
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('settings.clinicSync.deviceName')}</span>
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder={t('settings.clinicSync.deviceNamePlaceholder') ?? ''}
            />
          </label>
          <button className="btn btn--primary" type="submit" disabled={previewMutation.isPending}>
            {previewMutation.isPending ? t('common.loading') : t('settings.clinicSync.lookupClinic')}
          </button>
        </form>
      )}

      {preview && (
        <div className="clinic-sync-confirm">
          <h3>{t('settings.clinicSync.confirmTitle')}</h3>
          <p>{t('settings.clinicSync.confirmLead')}</p>
          <dl className="clinic-sync-identity">
            <div>
              <dt>{t('settings.clinicSync.clinicName')}</dt>
              <dd>{preview.clinicName}</dd>
            </div>
            <div>
              <dt>{t('settings.clinicSync.clinicId')}</dt>
              <dd className="clinic-sync-mono">{preview.clinicId}</dd>
            </div>
            <div>
              <dt>{t('settings.clinicSync.onlineUrl')}</dt>
              <dd>{preview.onlineUrl}</dd>
            </div>
          </dl>
          <p className="muted">{t('settings.clinicSync.confirmHint')}</p>
          <div className="settings-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPreview(null);
                onSuccess(null);
              }}
            >
              {t('common.back')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={connectMutation.isPending}
              onClick={() => connectMutation.mutate()}
            >
              {connectMutation.isPending ? t('common.loading') : t('settings.clinicSync.confirmConnect')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConflictReview({
  conflicts,
  locale,
  onError,
  onChanged,
}: {
  conflicts: Array<{
    conflictId: string;
    entity: string;
    recordUid: string;
    reason: string;
    createdAt: string;
  }>;
  locale: string;
  onError: (err: unknown | null) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<{ id: string; resolution: 'keep_local' | 'keep_remote' } | null>(null);

  const resolveMutation = useMutation({
    mutationFn: (input: { id: string; resolution: 'keep_local' | 'keep_remote' }) =>
      syncApi.resolveConflict(input.id, input.resolution),
    onSuccess: () => {
      setPending(null);
      onChanged();
    },
    onError: (err) => onError(err),
  });

  const pendingConflict = useMemo(
    () => conflicts.find((c) => c.conflictId === pending?.id),
    [conflicts, pending],
  );

  return (
    <div className="clinic-sync-panel">
      <h3>{t('settings.clinicSync.conflictList')}</h3>
      <p className="muted">{t('settings.clinicSync.conflictHint')}</p>
      <ul className="clinic-sync-conflicts">
        {conflicts.map((c) => (
          <li key={c.conflictId}>
            <div>
              <strong>{c.entity}</strong>
              <span className="muted">{c.reason}</span>
              <span className="muted">{formatDateTimeDisplay(c.createdAt, locale)}</span>
            </div>
            <span className="clinic-sync-conflict-actions">
              <button type="button" className="link-btn" onClick={() => setPending({ id: c.conflictId, resolution: 'keep_local' })}>
                {t('settings.clinicSync.keepLocal')}
              </button>
              <button type="button" className="link-btn" onClick={() => setPending({ id: c.conflictId, resolution: 'keep_remote' })}>
                {t('settings.clinicSync.keepRemote')}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {pending && pendingConflict && (
        <Modal title={t('settings.clinicSync.conflictConfirmTitle')} onClose={() => setPending(null)}>
          <p>
            {pending.resolution === 'keep_local'
              ? t('settings.clinicSync.keepLocalConfirm')
              : t('settings.clinicSync.keepRemoteConfirm')}
          </p>
          <p className="muted">
            {pendingConflict.entity} — {pendingConflict.reason}
          </p>
          <div className="settings-actions">
            <button type="button" className="btn" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={resolveMutation.isPending}
              onClick={() => resolveMutation.mutate(pending)}
            >
              {t('common.confirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
