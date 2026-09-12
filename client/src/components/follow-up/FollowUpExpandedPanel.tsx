import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Pencil, Save } from 'lucide-react';
import { followUpsApi } from '@/api/follow-ups.api';
import { paymentMethodsApi } from '@/api/settings.api';
import { FormField } from '@/components/common/FormField';
import { FollowUpHistoryEntry, FollowUpResult, FollowUpWithPatient } from '@/types/domain';
import { todayIso } from '@/utils/date';
import { DateField } from '@/components/common/DateField';
import { getErrorMessage } from '@/utils/errors';
import { formatMoney } from '@/utils/money';

const CLINICAL_RESULTS: FollowUpResult[] = ['FINE', 'PAIN', 'SWELLING', 'NEEDS_APPOINTMENT', 'NO_ANSWER'];
const FINANCIAL_RESULTS: FollowUpResult[] = [
  'REMINDER_SENT',
  'PROMISED_PAYMENT',
  'PAID_INSTALLMENT',
  'NO_ANSWER',
  'SETTLED',
];

const DEFAULT_DURATION = 30;

type Props = {
  fu: FollowUpWithPatient;
  latestHistory?: FollowUpHistoryEntry;
  onDone: () => void;
  onWhatsApp: (fu: FollowUpWithPatient) => void;
};

export function FollowUpExpandedPanel({ fu, latestHistory, onDone, onWhatsApp }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isCompleted = fu.status === 'COMPLETED';

  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(fu.followUpDate);
  const [editReason, setEditReason] = useState(fu.reason);
  const [editDetails, setEditDetails] = useState(fu.details ?? '');
  const [editNote, setEditNote] = useState(fu.note ?? '');
  const [actionNote, setActionNote] = useState('');
  const [nextDate, setNextDate] = useState(todayIso());
  const [selectedResult, setSelectedResult] = useState<FollowUpResult | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [apptDate, setApptDate] = useState(todayIso());
  const [apptTime, setApptTime] = useState('09:00');
  const [apptDuration, setApptDuration] = useState(DEFAULT_DURATION);
  const [apptReason, setApptReason] = useState(fu.reason);

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payDate, setPayDate] = useState(todayIso());
  const [payNote, setPayNote] = useState('');

  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods-active'],
    queryFn: () => paymentMethodsApi.listActive(),
  });

  useEffect(() => {
    setEditDate(fu.followUpDate);
    setEditReason(fu.reason);
    setEditDetails(fu.details ?? '');
    setEditNote(fu.note ?? '');
    setApptReason(fu.reason);
    setSavedAt(null);
    setSelectedResult(null);
    setActionNote('');
  }, [fu]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
    queryClient.invalidateQueries({ queryKey: ['follow-ups-summary'] });
    queryClient.invalidateQueries({ queryKey: ['follow-ups-history'] });
    queryClient.invalidateQueries({ queryKey: ['follow-ups-today'] });
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      followUpsApi.update(fu.id, {
        followUpDate: editDate,
        reason: editReason.trim(),
        details: editDetails.trim() || undefined,
        note: editNote.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const markSaved = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setSavedAt(`${hh}:${mm}`);
  };

  const completeMutation = useMutation({
    mutationFn: (payload: Parameters<typeof followUpsApi.complete>[1]) => followUpsApi.complete(fu.id, payload),
    onSuccess: () => {
      invalidate();
      setSelectedResult(null);
      setActionNote('');
      setError(null);
      markSaved();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const financialMutation = useMutation({
    mutationFn: (payload: Parameters<typeof followUpsApi.financialAction>[1]) =>
      followUpsApi.financialAction(fu.id, payload),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['account-summary', fu.patientId] });
      setSelectedResult(null);
      setPayAmount('');
      setActionNote('');
      setError(null);
      markSaved();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function needsNextDate(result: FollowUpResult) {
    return result === 'NO_ANSWER' || result === 'PAIN' || result === 'SWELLING' || result === 'PROMISED_PAYMENT';
  }

  function handleSaveClinical() {
    if (!selectedResult) return;
    if (selectedResult === 'NEEDS_APPOINTMENT') {
      completeMutation.mutate({
        result: selectedResult,
        note: actionNote.trim() || undefined,
        appointment: {
          date: apptDate,
          time: apptTime,
          durationMin: apptDuration,
          reason: apptReason.trim() || fu.reason,
        },
      });
      return;
    }
    if (selectedResult === 'NO_ANSWER' && !nextDate) {
      setError(t('followUp.validation.nextDateRequired'));
      return;
    }
    completeMutation.mutate({
      result: selectedResult,
      note: actionNote.trim() || undefined,
      nextFollowUpDate: needsNextDate(selectedResult) ? nextDate : undefined,
      reschedule: selectedResult === 'PAIN' || selectedResult === 'SWELLING' ? !!nextDate : undefined,
    });
  }

  function handleSaveFinancial() {
    if (!selectedResult) return;
    if ((selectedResult === 'NO_ANSWER' || selectedResult === 'PROMISED_PAYMENT') && !nextDate) {
      setError(t('followUp.validation.nextDateRequired'));
      return;
    }
    if (selectedResult === 'PAID_INSTALLMENT') {
      const amount = parseFloat(payAmount);
      if (!amount || amount <= 0) {
        setError(t('followUp.validation.amountRequired'));
        return;
      }
      financialMutation.mutate({
        result: selectedResult,
        note: actionNote.trim() || undefined,
        payment: {
          amount,
          method: payMethod,
          date: payDate,
          note: payNote.trim() || undefined,
        },
      });
      return;
    }
    financialMutation.mutate({
      result: selectedResult,
      note: actionNote.trim() || undefined,
      nextFollowUpDate:
        selectedResult === 'NO_ANSWER' || selectedResult === 'PROMISED_PAYMENT' ? nextDate : undefined,
    });
  }

  const pending = completeMutation.isPending || financialMutation.isPending || updateMutation.isPending;

  if (isCompleted) {
    return (
      <div className="follow-up-expand follow-up-expand--completed">
        <div className="follow-up-expand__completed-badge">
          {t('followUp.completedToday')} ✓
        </div>
        {latestHistory?.result && (
          <p className="muted">
            {t('followUp.columns.result')}: {t(`followUp.results.${latestHistory.result}`)}
          </p>
        )}
        {latestHistory?.appointmentSummary && (
          <p className="muted">{latestHistory.appointmentSummary}</p>
        )}
        {latestHistory?.paymentAmountCents != null && (
          <p className="muted">
            {t('followUp.paymentRecorded')}: {formatMoney(latestHistory.paymentAmountCents)}
          </p>
        )}
        {latestHistory?.note && <p className="muted">{latestHistory.note}</p>}
      </div>
    );
  }

  return (
    <div className="follow-up-expand">
      <div className="follow-up-expand__toolbar">
        <button
          type="button"
          className="icon-btn"
          title={editing ? t('common.save') : t('common.edit')}
          onClick={() => (editing ? updateMutation.mutate() : setEditing(true))}
          disabled={pending}
        >
          {editing ? <Save size={15} /> : <Pencil size={15} />}
        </button>
        <button
          type="button"
          className="icon-btn btn--whatsapp"
          title={t('followUp.actions.whatsapp')}
          onClick={() => onWhatsApp(fu)}
        >
          <MessageCircle size={15} />
        </button>
      </div>

      {editing && (
        <div className="follow-up-expand__edit-grid">
          <FormField label={t('followUp.columns.date')}>
            <DateField value={editDate} onChange={setEditDate} />
          </FormField>
          <FormField label={t('followUp.columns.reason')}>
            <input value={editReason} onChange={(e) => setEditReason(e.target.value)} />
          </FormField>
          {fu.type === 'CLINICAL' && (
            <FormField label={t('followUp.columns.details')}>
              <input value={editDetails} onChange={(e) => setEditDetails(e.target.value)} />
            </FormField>
          )}
          <FormField label={t('common.note')}>
            <input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </FormField>
        </div>
      )}

      {fu.type === 'CLINICAL' ? (
        <>
          <p className="follow-up-expand__hint">{t('followUp.clinicalResultHint')}</p>
          <div className="follow-up-expand__buttons">
            {CLINICAL_RESULTS.map((r) => (
              <button
                key={r}
                type="button"
                className={selectedResult === r ? 'btn btn--primary btn--small' : 'btn btn--ghost btn--small'}
                onClick={() => setSelectedResult(r)}
                disabled={pending}
              >
                {t(`followUp.results.${r}`)}
              </button>
            ))}
          </div>
          {selectedResult === 'NEEDS_APPOINTMENT' && (
            <div className="follow-up-expand__inline-form">
              <FormField label={t('common.date')}>
                <DateField value={apptDate} onChange={setApptDate} />
              </FormField>
              <FormField label={t('common.time')}>
                <input type="time" value={apptTime} onChange={(e) => setApptTime(e.target.value)} />
              </FormField>
              <FormField label={t('appointmentsPage.duration')}>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={apptDuration}
                  onChange={(e) => setApptDuration(Number(e.target.value))}
                />
              </FormField>
              <FormField label={t('appointmentsPage.reason')}>
                <input value={apptReason} onChange={(e) => setApptReason(e.target.value)} />
              </FormField>
            </div>
          )}
          {selectedResult && needsNextDate(selectedResult) && (
            <FormField label={t('followUp.actions.nextDate')}>
              <DateField value={nextDate} onChange={setNextDate} />
            </FormField>
          )}
        </>
      ) : (
        <>
          <div className="follow-up-expand__financial">
            <span>
              {t('receipt.invoiceTotal')}: <strong>{formatMoney(fu.totalCostCents ?? 0)}</strong>
            </span>
            <span>
              {t('receipt.paid')}: <strong>{formatMoney(fu.totalPaidCents ?? 0)}</strong>
            </span>
            <span>
              {t('followUp.remaining')}: <strong>{formatMoney(fu.remainingCents ?? 0)}</strong>
            </span>
          </div>
          <div className="follow-up-expand__buttons">
            {FINANCIAL_RESULTS.map((r) => (
              <button
                key={r}
                type="button"
                className={selectedResult === r ? 'btn btn--primary btn--small' : 'btn btn--ghost btn--small'}
                onClick={() => setSelectedResult(r)}
                disabled={pending || (r === 'SETTLED' && (fu.remainingCents ?? 0) > 0)}
              >
                {t(`followUp.results.${r}`)}
              </button>
            ))}
          </div>
          {selectedResult === 'PAID_INSTALLMENT' && (
            <div className="follow-up-expand__inline-form">
              <FormField label={t('patientRecord.account.amount')} required>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </FormField>
              <FormField label={t('patientRecord.account.method')}>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {methods.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.code === 'CASH' ? t('patientRecord.paymentMethod.CASH') : m.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label={t('patientRecord.account.date')}>
                <DateField value={payDate} onChange={setPayDate} />
              </FormField>
              <FormField label={t('common.note')}>
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </FormField>
            </div>
          )}
          {selectedResult &&
            (selectedResult === 'NO_ANSWER' || selectedResult === 'PROMISED_PAYMENT') && (
              <FormField label={t('followUp.actions.nextDate')}>
                <DateField value={nextDate} onChange={setNextDate} />
              </FormField>
            )}
        </>
      )}

      <FormField label={t('common.note')}>
        <input
          value={actionNote}
          onChange={(e) => setActionNote(e.target.value)}
          placeholder={t('followUp.notePlaceholder') ?? ''}
        />
      </FormField>

      {error && <div className="form-error-banner">{error}</div>}

      {savedAt && (
        <p className="follow-up-expand__saved-confirmation">{t('followUp.savedAt', { time: savedAt })}</p>
      )}

      {selectedResult && (
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--primary btn--small"
            disabled={pending}
            onClick={fu.type === 'CLINICAL' ? handleSaveClinical : handleSaveFinancial}
          >
            <Save size={14} /> {t('common.save')}
          </button>
        </div>
      )}
    </div>
  );
}
