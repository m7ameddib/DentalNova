import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, FileText, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/common/SectionCard';
import { attachmentsApi } from '@/api/attachments.api';
import { patientsApi } from '@/api/patients.api';
import { clinicalApi } from '@/api/clinical.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { getErrorMessage } from '@/utils/errors';
import { useUiStore } from '@/store/ui.store';
import { formatDateTimeDisplay, formatDateDisplay } from '@/utils/date';
import { AttachmentCategory, PatientAttachment } from '@/types/domain';

const CATEGORIES: AttachmentCategory[] = ['XRAY', 'PHOTO', 'DOCUMENT', 'OTHER'];

export function FilesSection({ patientId }: { patientId: number }) {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const queryClient = useQueryClient();
  const canEdit = usePermission(PERMISSIONS.PATIENTS_EDIT);

  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<AttachmentCategory>('XRAY');
  const [note, setNote] = useState('');
  const [linkTeeth, setLinkTeeth] = useState('');
  const [linkTreatmentId, setLinkTreatmentId] = useState<number | ''>('');
  const [linkVisitNoteId, setLinkVisitNoteId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: files = [] } = useQuery({
    queryKey: ['patient-attachments', patientId],
    queryFn: () => attachmentsApi.list(patientId),
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ['patient-treatments', patientId],
    queryFn: () => patientsApi.treatments(patientId),
    enabled: adding,
  });

  const { data: visitNotes = [] } = useQuery({
    queryKey: ['clinical-visit-notes', patientId],
    queryFn: () => clinicalApi.listVisitNotes(patientId),
    enabled: adding,
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      const teeth = linkTeeth.trim()
        ? linkTeeth.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n))
        : undefined;
      return attachmentsApi.upload(patientId, file!, {
        category,
        note: note.trim() || undefined,
        patientTreatmentId: linkTreatmentId === '' ? undefined : Number(linkTreatmentId),
        clinicalVisitNoteId: linkVisitNoteId === '' ? undefined : Number(linkVisitNoteId),
        teeth,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-attachments', patientId] });
      resetForm();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) => attachmentsApi.remove(patientId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-attachments', patientId] });
      setConfirmDeleteId(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function resetForm() {
    setAdding(false);
    setFile(null);
    setCategory('XRAY');
    setNote('');
    setLinkTeeth('');
    setLinkTreatmentId('');
    setLinkVisitNoteId('');
    setError(null);
  }

  function handleSave() {
    if (!file) {
      setError(t('patientRecord.files.validation.fileRequired'));
      return;
    }
    uploadMutation.mutate();
  }

  async function handleOpen(attachment: PatientAttachment) {
    const blob = await attachmentsApi.fetchFileBlob(patientId, attachment.id);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function formatLinkMeta(a: PatientAttachment): string | null {
    const parts: string[] = [];
    if (a.teeth?.length) parts.push(t('patientRecord.files.linkTeethShort', { teeth: a.teeth.join(', ') }));
    if (a.treatmentLabel) parts.push(a.treatmentLabel);
    if (a.visitDate) parts.push(formatDateDisplay(a.visitDate, language));
    return parts.length ? parts.join(' · ') : null;
  }

  return (
    <SectionCard
      title={t('patientRecord.sections.files')}
      icon={<Paperclip size={16} />}
      onAdd={canEdit ? () => setAdding((v) => !v) : undefined}
      addTitle={t('patientRecord.files.uploadTitle') ?? ''}
      className="section-card--files"
    >
      {adding && (
        <div className="inline-form">
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.files.chooseFile')}</span>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {!file && <span className="muted file-input-hint">{t('patientRecord.files.noFileChosen')}</span>}
          </label>

          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.files.category')}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as AttachmentCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`patientRecord.files.categories.${c}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.files.linkTeeth')}</span>
            <input
              value={linkTeeth}
              onChange={(e) => setLinkTeeth(e.target.value)}
              placeholder={t('patientRecord.files.linkTeethPlaceholder') ?? ''}
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.files.linkTreatment')}</span>
            <select value={linkTreatmentId} onChange={(e) => setLinkTreatmentId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{t('patientRecord.files.linkOptional')}</option>
              {treatments.filter((tr) => tr.status !== 'VOID').map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.treatmentLabel}{tr.teeth.length ? ` (${tr.teeth.join(', ')})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.files.linkVisit')}</span>
            <select value={linkVisitNoteId} onChange={(e) => setLinkVisitNoteId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{t('patientRecord.files.linkOptional')}</option>
              {visitNotes.map((n) => (
                <option key={n.id} value={n.id}>
                  {formatDateDisplay(n.visitDate, language)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.files.note')}</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('patientRecord.files.notePlaceholder') ?? ''}
            />
          </label>

          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={resetForm}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSave}
              disabled={uploadMutation.isPending}
            >
              {t('common.upload')}
            </button>
          </div>
        </div>
      )}

      {!adding && (
        <div className="attachments-list">
          {files.length === 0 ? (
            <p className="muted">{t('patientRecord.files.noFiles')}</p>
          ) : (
            files.map((a) => {
              const linkMeta = formatLinkMeta(a);
              return (
              <div key={a.id} className="attachment-row">
                <AttachmentThumbnail patientId={patientId} attachment={a} onOpen={() => handleOpen(a)} />
                <div className="attachment-row__info" onClick={() => handleOpen(a)}>
                  <span className="attachment-row__name">{a.originalFileName}</span>
                  <span className="muted attachment-row__meta">
                    {t(`patientRecord.files.categories.${a.category}`)} ·{' '}
                    {formatDateTimeDisplay(a.createdAt, language)}
                    {linkMeta ? ` · ${linkMeta}` : ''}
                  </span>
                </div>
                {canEdit && (
                  <div className="attachment-row__actions">
                    {confirmDeleteId === a.id ? (
                      <span className="treatment-history__confirm">
                        <button
                          type="button"
                          className="link-btn link-btn--danger"
                          onClick={() => deleteMutation.mutate(a.id)}
                          disabled={deleteMutation.isPending}
                        >
                          {t('common.confirm')}
                        </button>
                        <button type="button" className="link-btn" onClick={() => setConfirmDeleteId(null)}>
                          {t('common.cancel')}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        title={t('common.delete') ?? ''}
                        onClick={() => setConfirmDeleteId(a.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
            })
          )}
          {error && <div className="form-error-banner">{error}</div>}
        </div>
      )}
    </SectionCard>
  );
}

function AttachmentThumbnail({
  patientId,
  attachment,
  onOpen,
}: {
  patientId: number;
  attachment: PatientAttachment;
  onOpen: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const isImage = !!attachment.mimeType?.startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    attachmentsApi.fetchFileBlob(patientId, attachment.id).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setThumbUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id, isImage]);

  if (isImage && thumbUrl) {
    return (
      <button type="button" className="attachment-row__thumb" onClick={onOpen}>
        <img src={thumbUrl} alt={attachment.originalFileName} />
      </button>
    );
  }
  return (
    <button type="button" className="attachment-row__thumb attachment-row__thumb--icon" onClick={onOpen}>
      <FileText size={20} />
    </button>
  );
}
