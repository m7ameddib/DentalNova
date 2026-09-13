import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RefreshCw, Rocket } from 'lucide-react';
import { updatesApi } from '@/api/updates.api';
import { getErrorMessage } from '@/utils/errors';

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdatesSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ['updates-status'],
    queryFn: updatesApi.status,
  });

  const checkMutation = useMutation({
    mutationFn: updatesApi.check,
    onSuccess: (status) => {
      queryClient.setQueryData(['updates-status'], status);
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const downloadMutation = useMutation({
    mutationFn: updatesApi.download,
    onMutate: () => {
      setDownloadStarted(true);
      setSuccess(null);
      setError(null);
    },
    onSuccess: (status) => {
      queryClient.setQueryData(['updates-status'], status);
      setDownloadStarted(false);
      setSuccess(t('settings.updates.downloadSuccess'));
      setError(null);
      void refetch();
    },
    onError: (err) => {
      setDownloadStarted(false);
      setError(getErrorMessage(err, t('common.error')));
    },
  });

  const launchMutation = useMutation({
    mutationFn: updatesApi.launchInstaller,
    onSuccess: () => {
      setSuccess(t('settings.updates.launchSuccess'));
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const busy =
    isFetching ||
    checkMutation.isPending ||
    downloadMutation.isPending ||
    launchMutation.isPending;

  const downloaded = Boolean(data?.downloaded);
  const downloading = downloadStarted || downloadMutation.isPending;

  return (
    <section className="settings-section">
      <h2>{t('settings.updates.title')}</h2>
      <p className="muted">{t('settings.updates.subtitle')}</p>

      <dl className="updates-info-grid">
        <div>
          <dt>{t('settings.updates.currentVersion')}</dt>
          <dd>{data?.currentVersion ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('settings.updates.latestVersion')}</dt>
          <dd>{data?.latestVersion ?? t('settings.updates.unknown')}</dd>
        </div>
        <div>
          <dt>{t('settings.updates.installer')}</dt>
          <dd>{data?.installerFileName ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('settings.updates.source')}</dt>
          <dd>GitHub — {data?.githubRepo ?? 'm7ameddib/DentalNova'}</dd>
        </div>
      </dl>

      {data?.checkError ? (
        <p className="form-error-banner">{data.checkError}</p>
      ) : data?.updateAvailable ? (
        <p className="updates-banner updates-banner--available">{t('settings.updates.available')}</p>
      ) : data?.latestVersion ? (
        <p className="muted">{t('settings.updates.upToDate')}</p>
      ) : (
        <p className="muted">{t('settings.updates.unknown')}</p>
      )}

      {data?.releaseNotes && (
        <div className="updates-release-notes">
          <h3>{t('settings.updates.releaseNotes')}</h3>
          <pre>{data.releaseNotes}</pre>
        </div>
      )}

      {downloading && (
        <p className="updates-banner updates-banner--available" role="status">
          {t('settings.updates.downloading')}
        </p>
      )}

      {downloaded && !downloading && (
        <p className="form-success-banner">
          {t('settings.updates.downloaded', {
            name: data?.installerFileName ?? '',
            size: formatBytes(data?.downloadedSizeBytes ?? null),
          })}
        </p>
      )}

      <div className="settings-actions">
        <button
          type="button"
          className="btn btn--secondary"
          disabled={busy}
          onClick={() => checkMutation.mutate()}
        >
          <RefreshCw size={15} /> {t('settings.updates.check')}
        </button>

        {data?.updateAvailable && !downloaded && (
          <button
            type="button"
            className="btn btn--secondary"
            disabled={busy || !data.downloadUrl}
            onClick={() => downloadMutation.mutate()}
          >
            <Download size={15} /> {downloading ? t('settings.updates.downloading') : t('settings.updates.download')}
          </button>
        )}

        {downloaded && !downloading && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={launchMutation.isPending}
            onClick={() => {
              if (window.confirm(t('settings.updates.launchConfirm'))) {
                launchMutation.mutate();
              }
            }}
          >
            <Rocket size={15} /> {t('settings.updates.launch')}
          </button>
        )}
      </div>

      <p className="muted updates-safety-note">{t('settings.updates.dataSafety')}</p>

      {error && <div className="form-error-banner">{error}</div>}
      {success && <div className="form-success-banner">{success}</div>}
    </section>
  );
}
