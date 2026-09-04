import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, HardDriveDownload, HardDriveUpload, ShieldCheck } from 'lucide-react';
import { backupApi } from '@/api/backup.api';
import { getErrorMessage } from '@/utils/errors';
import { useAuthStore } from '@/store/auth.store';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: backups = [], refetch } = useQuery({
    queryKey: ['backups'],
    queryFn: () => backupApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: backupApi.create,
    onSuccess: () => {
      refetch();
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const validateMutation = useMutation({
    mutationFn: (file: File) => backupApi.validate(file),
    onSuccess: () => {
      setValidationMessage(t('settings.backup.valid'));
      setError(null);
    },
    onError: () => {
      setValidationMessage(t('settings.backup.invalid'));
      setError(t('settings.backup.invalid'));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (file: File) => backupApi.restore(file, true),
    onSuccess: () => {
      setSuccess(t('settings.backup.restoreSuccess'));
      setSelectedFile(null);
      setValidationMessage(null);
      queryClient.clear();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  async function handleDownload(filename: string) {
    const url = backupApi.downloadUrl(filename);
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setError(t('common.error'));
      return;
    }
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.backup.title')}</h2>
      <p className="muted">{t('settings.backup.description')}</p>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <HardDriveDownload size={14} />{' '}
          {createMutation.isPending ? t('settings.backup.creating') : t('settings.backup.create')}
        </button>
      </div>

      {backups.length === 0 ? (
        <p className="muted">{t('settings.backup.noBackups')}</p>
      ) : (
        <table className="patients-table">
          <thead>
            <tr>
              <th>{t('settings.backup.createdAt')}</th>
              <th>{t('settings.backup.size')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.id}>
                <td>{new Date(b.createdAt).toLocaleString()}</td>
                <td>{formatBytes(b.sizeBytes)}</td>
                <td>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => handleDownload(b.filename)}>
                    <Download size={14} /> {t('settings.backup.download')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="settings-section__sub-title">{t('settings.backup.restore')}</h3>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          setSelectedFile(file);
          setValidationMessage(null);
          setSuccess(null);
          setError(null);
        }}
      />
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>
          {t('settings.backup.selectFile')}
        </button>
        {selectedFile && (
          <>
            <span className="muted">{selectedFile.name}</span>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => selectedFile && validateMutation.mutate(selectedFile)}
              disabled={validateMutation.isPending}
            >
              <ShieldCheck size={14} /> {t('settings.backup.validateFirst')}
            </button>
            <button
              type="button"
              className="btn btn--danger btn--small"
              onClick={() => {
                if (!selectedFile) return;
                if (!window.confirm(t('settings.backup.restoreConfirm'))) return;
                restoreMutation.mutate(selectedFile);
              }}
              disabled={restoreMutation.isPending}
            >
              <HardDriveUpload size={14} /> {t('settings.backup.restore')}
            </button>
          </>
        )}
      </div>

      {validationMessage && <p className="muted">{validationMessage}</p>}
      {success && <p className="muted">{success}</p>}
      {error && <div className="form-error-banner">{error}</div>}
    </section>
  );
}
