import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Printer, MessageCircle } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { patientsApi } from '@/api/patients.api';
import { paymentsApi } from '@/api/payments.api';
import { accountDiscountsApi } from '@/api/accountDiscounts.api';
import { settingsApi } from '@/api/settings.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { formatMoney } from '@/utils/money';
import { getErrorMessage } from '@/utils/errors';
import { useUiStore } from '@/store/ui.store';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { openWhatsApp } from '@/utils/whatsapp';
import { PaymentReceiptPrintable } from './PrintableTemplates';
import { Patient, Payment } from '@/types/domain';

export function PaymentHistoryModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const queryClient = useQueryClient();
  const print = usePrintStore((s) => s.print);
  const canVoid = usePermission(PERMISSIONS.PAYMENTS_VOID);

  const [voidingPaymentId, setVoidingPaymentId] = useState<number | null>(null);
  const [voidingDiscountId, setVoidingDiscountId] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [historyError, setHistoryError] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ['account-summary', patient.id],
    queryFn: () => patientsApi.accountSummary(patient.id),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['patient-payments', patient.id],
    queryFn: () => patientsApi.payments(patient.id),
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ['patient-account-discounts', patient.id],
    queryFn: () => patientsApi.accountDiscounts(patient.id),
  });

  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => settingsApi.getClinic(),
  });

  const voidPaymentMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => paymentsApi.void(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-summary', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['patient-payments', patient.id] });
      setVoidingPaymentId(null);
      setVoidReason('');
      setHistoryError(null);
    },
    onError: (err) => setHistoryError(getErrorMessage(err, t('common.error'))),
  });

  const voidDiscountMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => accountDiscountsApi.void(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-summary', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['patient-account-discounts', patient.id] });
      setVoidingDiscountId(null);
      setVoidReason('');
      setHistoryError(null);
    },
    onError: (err) => setHistoryError(getErrorMessage(err, t('common.error'))),
  });

  async function handlePrintReceipt(payment: Payment) {
    if (payment.status === 'VOID') return;
    const clinic = await loadClinicPrintInfo();
    print(
      <PaymentReceiptPrintable
        patient={patient}
        payment={payment}
        remainingCents={summary?.remainingCents ?? 0}
        clinic={clinic}
        language={language}
      />,
    );
  }

  function handleWhatsAppReceipt(payment: Payment) {
    if (payment.status === 'VOID') return;
    const message = t('whatsapp.paymentReceipt', {
      clinicName: clinicSettings?.clinicName || t('app.name'),
      patientName: patient.fullName,
      amount: formatMoney(payment.amountCents),
      date: payment.date,
      remaining: formatMoney(summary?.remainingCents ?? 0),
    });
    openWhatsApp(patient.phone, message);
  }

  function submitVoidPayment(id: number) {
    const reason = voidReason.trim();
    if (reason.length < 3) {
      setHistoryError(t('patientRecord.account.voidReasonRequired'));
      return;
    }
    voidPaymentMutation.mutate({ id, reason });
  }

  function submitVoidDiscount(id: number) {
    const reason = voidReason.trim();
    if (reason.length < 3) {
      setHistoryError(t('patientRecord.account.voidReasonRequired'));
      return;
    }
    voidDiscountMutation.mutate({ id, reason });
  }

  return (
    <Modal title={t('patientRecord.account.viewHistory')} icon={<History size={16} />} onClose={onClose} size="wide">
      <div className="payment-history">
        <h4 className="payment-history__section-title">{t('patientRecord.account.paymentsHistory')}</h4>
        {payments.length === 0 ? (
          <p className="muted">{t('patientRecord.account.noPayments')}</p>
        ) : (
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('patientRecord.account.amount')}</th>
                <th>{t('patientRecord.account.method')}</th>
                <th>{t('common.note')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className={p.status === 'VOID' ? 'payment-row--void' : undefined}>
                  <td>{p.date}</td>
                  <td>{formatMoney(p.amountCents)}</td>
                  <td>{p.methodLabel ?? p.method}</td>
                  <td className="muted">
                    {p.status === 'VOID' ? (
                      <span className="payment-void-label">
                        {t('patientRecord.account.voidLabel', { reason: p.voidReason ?? '' })}
                      </span>
                    ) : (
                      p.note || '—'
                    )}
                  </td>
                  <td className="payment-history-table__actions">
                    {p.status !== 'VOID' && (
                      <>
                        <button
                          type="button"
                          className="icon-btn"
                          title={t('patientRecord.account.printReceipt') ?? ''}
                          onClick={() => handlePrintReceipt(p)}
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--whatsapp"
                          title={t('whatsapp.sendReceipt') ?? ''}
                          disabled={!patient.phone}
                          onClick={() => handleWhatsAppReceipt(p)}
                        >
                          <MessageCircle size={14} />
                        </button>
                      </>
                    )}
                    {canVoid &&
                      p.status !== 'VOID' &&
                      (voidingPaymentId === p.id ? (
                        <span className="payment-void-form">
                          <input
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                            placeholder={t('patientRecord.account.voidReasonPlaceholder') ?? ''}
                          />
                          <button
                            type="button"
                            className="link-btn link-btn--danger"
                            onClick={() => submitVoidPayment(p.id)}
                            disabled={voidPaymentMutation.isPending}
                          >
                            {t('patientRecord.account.voidConfirm')}
                          </button>
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => {
                              setVoidingPaymentId(null);
                              setVoidReason('');
                            }}
                          >
                            {t('common.cancel')}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="link-btn link-btn--danger"
                          onClick={() => {
                            setVoidingDiscountId(null);
                            setVoidingPaymentId(p.id);
                            setVoidReason('');
                          }}
                        >
                          {t('patientRecord.account.voidPayment')}
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h4 className="payment-history__section-title">{t('patientRecord.account.discountsHistory')}</h4>
        {discounts.length === 0 ? (
          <p className="muted">{t('patientRecord.account.noDiscounts')}</p>
        ) : (
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('patientRecord.account.discountAmount')}</th>
                <th>{t('common.note')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id} className={d.status === 'VOID' ? 'payment-row--void' : undefined}>
                  <td>{d.date}</td>
                  <td>-{formatMoney(d.amountCents)}</td>
                  <td className="muted">
                    {d.status === 'VOID' ? (
                      <span className="payment-void-label">
                        {t('patientRecord.account.voidLabel', { reason: d.voidReason ?? '' })}
                      </span>
                    ) : (
                      d.note || '—'
                    )}
                  </td>
                  <td className="payment-history-table__actions">
                    {canVoid &&
                      d.status !== 'VOID' &&
                      (voidingDiscountId === d.id ? (
                        <span className="payment-void-form">
                          <input
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                            placeholder={t('patientRecord.account.voidReasonPlaceholder') ?? ''}
                          />
                          <button
                            type="button"
                            className="link-btn link-btn--danger"
                            onClick={() => submitVoidDiscount(d.id)}
                            disabled={voidDiscountMutation.isPending}
                          >
                            {t('patientRecord.account.voidConfirm')}
                          </button>
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => {
                              setVoidingDiscountId(null);
                              setVoidReason('');
                            }}
                          >
                            {t('common.cancel')}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="link-btn link-btn--danger"
                          onClick={() => {
                            setVoidingPaymentId(null);
                            setVoidingDiscountId(d.id);
                            setVoidReason('');
                          }}
                        >
                          {t('patientRecord.account.voidDiscount')}
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {historyError && <div className="form-error-banner">{historyError}</div>}
      </div>
    </Modal>
  );
}
