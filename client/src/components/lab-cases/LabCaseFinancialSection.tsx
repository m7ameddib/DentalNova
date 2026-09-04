import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { labCasesApi } from '@/api/lab-cases.api';
import { paymentMethodsApi } from '@/api/settings.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { formatMoney } from '@/utils/money';
import { getErrorMessage } from '@/utils/errors';
import { todayIso } from '@/utils/date';
import { LabCaseWithDetails } from '@/types/domain';

export function LabCaseFinancialSection({ labCase }: { labCase: LabCaseWithDetails }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canPay = usePermission(PERMISSIONS.LAB_PAYMENTS_RECORD);
  const canVoid = usePermission(PERMISSIONS.LAB_PAYMENTS_VOID);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [payDate, setPayDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [voidingId, setVoidingId] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: caseDetails = labCase } = useQuery({
    queryKey: ['lab-case', labCase.id],
    queryFn: () => labCasesApi.getById(labCase.id),
    initialData: labCase,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['lab-case-payments', labCase.id],
    queryFn: () => labCasesApi.listPayments(labCase.id),
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodsApi.listActive(),
  });

  const recordMutation = useMutation({
    mutationFn: () =>
      labCasesApi.recordPayment(labCase.id, {
        amount: Number(amount),
        paymentMethod: method || paymentMethods[0]?.code || 'CASH',
        paymentDate: payDate,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-case', labCase.id] });
      queryClient.invalidateQueries({ queryKey: ['lab-case-payments', labCase.id] });
      queryClient.invalidateQueries({ queryKey: ['lab-cases'] });
      queryClient.invalidateQueries({ queryKey: ['patient-lab-cases'] });
      setAmount('');
      setNote('');
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const voidMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: number; reason: string }) =>
      labCasesApi.voidPayment(labCase.id, paymentId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-case', labCase.id] });
      queryClient.invalidateQueries({ queryKey: ['lab-case-payments', labCase.id] });
      queryClient.invalidateQueries({ queryKey: ['lab-cases'] });
      queryClient.invalidateQueries({ queryKey: ['patient-lab-cases'] });
      setVoidingId(null);
      setVoidReason('');
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const statusKey = caseDetails.labPaymentStatus ?? 'UNPAID';

  return (
    <div className="lab-case-financial">
      <h4>{t('labCases.financial.title')}</h4>
      <p className="muted lab-case-financial__hint">{t('labCases.financial.clinicOwesLab')}</p>
      <div className="lab-case-financial__summary">
        <span>{t('labCases.financial.labCost')}: <strong>{formatMoney(caseDetails.labCostCents ?? 0)}</strong></span>
        <span>{t('labCases.financial.paid')}: <strong>{formatMoney(caseDetails.totalPaidCents ?? 0)}</strong></span>
        <span>{t('labCases.financial.remaining')}: <strong>{formatMoney(caseDetails.remainingLabBalanceCents ?? 0)}</strong></span>
        <span>{t('labCases.financial.status')}: <strong>{t(`labCases.financial.paymentStatus.${statusKey}`)}</strong></span>
      </div>

      {payments.length > 0 && (
        <table className="payment-history-table lab-case-payments-table">
          <thead>
            <tr>
              <th>{t('common.date')}</th>
              <th>{t('patientRecord.account.amount')}</th>
              <th>{t('patientRecord.account.method')}</th>
              <th>{t('common.note')}</th>
              {canVoid && <th>{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className={p.status === 'VOID' ? 'payment-row--void' : undefined}>
                <td>{p.paymentDate}</td>
                <td>{formatMoney(p.amountCents)}</td>
                <td>{p.paymentMethod}</td>
                <td className="muted">{p.status === 'VOID' ? p.voidReason : p.note || '—'}</td>
                {canVoid && p.status !== 'VOID' && (
                  <td>
                    {voidingId === p.id ? (
                      <span className="payment-void-form">
                        <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder={t('labCases.financial.voidReason') ?? ''} />
                        <button type="button" className="link-btn link-btn--danger" onClick={() => voidMutation.mutate({ paymentId: p.id, reason: voidReason })}>{t('common.confirm')}</button>
                        <button type="button" className="link-btn" onClick={() => setVoidingId(null)}>{t('common.cancel')}</button>
                      </span>
                    ) : (
                      <button type="button" className="link-btn link-btn--danger" onClick={() => setVoidingId(p.id)}>{t('labCases.financial.voidPayment')}</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canPay && (caseDetails.remainingLabBalanceCents ?? 0) > 0 && (
        <div className="inline-form lab-case-payment-form">
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.account.amount')}</span>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.account.method')}</span>
            <select value={method || paymentMethods[0]?.code || ''} onChange={(e) => setMethod(e.target.value)}>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.code}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('common.date')}</span>
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('common.note')}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" className="btn btn--primary btn--small" onClick={() => recordMutation.mutate()} disabled={recordMutation.isPending || !amount}>
            {t('labCases.financial.recordPayment')}
          </button>
        </div>
      )}
      {error && <div className="form-error-banner">{error}</div>}
    </div>
  );
}
