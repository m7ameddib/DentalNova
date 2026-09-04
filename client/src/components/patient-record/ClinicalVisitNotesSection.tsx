import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Pencil } from 'lucide-react';
import { SectionCard } from '@/components/common/SectionCard';
import { clinicalApi } from '@/api/clinical.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { getErrorMessage } from '@/utils/errors';
import { useUiStore } from '@/store/ui.store';
import { formatDateDisplay, formatDateTimeDisplay, todayIso } from '@/utils/date';
import { ClinicalVisitNote } from '@/types/domain';

const COLLAPSED_LIMIT = 5;

export function ClinicalVisitNotesSection({ patientId }: { patientId: number }) {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const queryClient = useQueryClient();
  const canManage = usePermission(PERMISSIONS.CLINICAL_NOTES_MANAGE);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClinicalVisitNote | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [visitDate, setVisitDate] = useState(todayIso());
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [examinationFindings, setExaminationFindings] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [procedureAction, setProcedureAction] = useState('');
  const [anesthesiaNote, setAnesthesiaNote] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [patientInstructions, setPatientInstructions] = useState('');

  const { data: notes = [] } = useQuery({
    queryKey: ['clinical-visit-notes', patientId],
    queryFn: () => clinicalApi.listVisitNotes(patientId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      clinicalApi.createVisitNote(patientId, {
        visitDate,
        chiefComplaint: chiefComplaint.trim() || undefined,
        examinationFindings: examinationFindings.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        procedureAction: procedureAction.trim() || undefined,
        anesthesiaNote: anesthesiaNote.trim() || undefined,
        clinicalNotes: clinicalNotes.trim() || undefined,
        patientInstructions: patientInstructions.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-visit-notes', patientId] });
      resetForm();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      clinicalApi.updateVisitNote(editing!.id, {
        visitDate,
        chiefComplaint: chiefComplaint.trim() || undefined,
        examinationFindings: examinationFindings.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        procedureAction: procedureAction.trim() || undefined,
        anesthesiaNote: anesthesiaNote.trim() || undefined,
        clinicalNotes: clinicalNotes.trim() || undefined,
        patientInstructions: patientInstructions.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-visit-notes', patientId] });
      resetForm();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function resetForm() {
    setAdding(false);
    setEditing(null);
    setVisitDate(todayIso());
    setChiefComplaint('');
    setExaminationFindings('');
    setDiagnosis('');
    setProcedureAction('');
    setAnesthesiaNote('');
    setClinicalNotes('');
    setPatientInstructions('');
    setError(null);
  }

  function startEdit(note: ClinicalVisitNote) {
    setEditing(note);
    setAdding(false);
    setVisitDate(note.visitDate);
    setChiefComplaint(note.chiefComplaint ?? '');
    setExaminationFindings(note.examinationFindings ?? '');
    setDiagnosis(note.diagnosis ?? '');
    setProcedureAction(note.procedureAction ?? '');
    setAnesthesiaNote(note.anesthesiaNote ?? '');
    setClinicalNotes(note.clinicalNotes ?? '');
    setPatientInstructions(note.patientInstructions ?? '');
    setError(null);
  }

  function handleSave() {
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  }

  const visibleNotes = showAll ? notes : notes.slice(0, COLLAPSED_LIMIT);
  const showForm = adding || editing;

  return (
    <SectionCard
      title={t('patientRecord.clinicalNotes.title')}
      icon={<ClipboardList size={16} />}
      onAdd={canManage ? () => { resetForm(); setAdding(true); } : undefined}
      addTitle={t('patientRecord.clinicalNotes.add') ?? ''}
      className="section-card--clinical-notes"
    >
      {showForm && (
        <div className="inline-form clinical-notes-form">
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.clinicalNotes.visitDate')}</span>
            <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.clinicalNotes.chiefComplaint')}</span>
            <textarea rows={2} value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.clinicalNotes.examination')}</span>
            <textarea rows={2} value={examinationFindings} onChange={(e) => setExaminationFindings(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.clinicalNotes.diagnosis')}</span>
            <textarea rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.clinicalNotes.procedure')}</span>
            <textarea rows={2} value={procedureAction} onChange={(e) => setProcedureAction(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.clinicalNotes.anesthesia')}</span>
            <input value={anesthesiaNote} onChange={(e) => setAnesthesiaNote(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.clinicalNotes.notes')}</span>
            <textarea rows={2} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.clinicalNotes.instructions')}</span>
            <textarea rows={2} value={patientInstructions} onChange={(e) => setPatientInstructions(e.target.value)} />
          </label>
          {error && <div className="form-error-banner">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={resetForm}>{t('common.cancel')}</button>
            <button type="button" className="btn btn--primary" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="clinical-notes-list">
          {notes.length === 0 ? (
            <p className="muted">{t('patientRecord.clinicalNotes.empty')}</p>
          ) : (
            <>
              {visibleNotes.map((n) => (
                <article key={n.id} className="clinical-note-card">
                  <header className="clinical-note-card__header">
                    <strong>{formatDateDisplay(n.visitDate, language)}</strong>
                    <span className="muted clinical-note-card__meta">
                      {formatDateTimeDisplay(n.createdAt, language)}
                      {n.createdByName ? ` · ${n.createdByName}` : ''}
                    </span>
                    {canManage && (
                      <button type="button" className="icon-btn" onClick={() => startEdit(n)} title={t('common.edit') ?? ''}>
                        <Pencil size={12} />
                      </button>
                    )}
                  </header>
                  {n.chiefComplaint && (
                    <p><span className="muted">{t('patientRecord.clinicalNotes.chiefComplaint')}:</span> {n.chiefComplaint}</p>
                  )}
                  {n.examinationFindings && (
                    <p><span className="muted">{t('patientRecord.clinicalNotes.examination')}:</span> {n.examinationFindings}</p>
                  )}
                  {n.diagnosis && (
                    <p><span className="muted">{t('patientRecord.clinicalNotes.diagnosis')}:</span> {n.diagnosis}</p>
                  )}
                  {n.procedureAction && (
                    <p><span className="muted">{t('patientRecord.clinicalNotes.procedure')}:</span> {n.procedureAction}</p>
                  )}
                  {n.anesthesiaNote && (
                    <p><span className="muted">{t('patientRecord.clinicalNotes.anesthesia')}:</span> {n.anesthesiaNote}</p>
                  )}
                  {n.clinicalNotes && (
                    <p><span className="muted">{t('patientRecord.clinicalNotes.notes')}:</span> {n.clinicalNotes}</p>
                  )}
                  {n.patientInstructions && (
                    <p><span className="muted">{t('patientRecord.clinicalNotes.instructions')}:</span> {n.patientInstructions}</p>
                  )}
                </article>
              ))}
              {notes.length > COLLAPSED_LIMIT && (
                <button type="button" className="link-btn" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? t('patientRecord.treatment.showLess') : t('patientRecord.treatment.showAll', { count: notes.length })}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </SectionCard>
  );
}
