import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, Printer, MessageCircle } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { DateField } from '@/components/common/DateField';
import { patientsApi } from '@/api/patients.api';
import { paymentsApi } from '@/api/payments.api';
import { accountDiscountsApi } from '@/api/accountDiscounts.api';
import { paymentMethodsApi, settingsApi } from '@/api/settings.api';
import { formatMoney, centsToAmount } from '@/utils/money';
import { formatDateDisplay } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import { useUiStore } from '@/store/ui.store';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { openWhatsApp } from '@/utils/whatsapp';
import { InvoiceReceiptPrintable } from './PrintableTemplates';
import { expandTreatmentDisplayRows } from '@/utils/treatment-display';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { AccountDiscount, Patient, Payment } from '@/types/domain';

export function InvoiceDetailsModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const print = usePrintStore((s) => s.print);
  const queryClient = useQueryClient();
  const canEdit = usePermission(PERMISSIONS.PAYMENTS_CREATE);
  const canVoid = usePermission(PERMISSIONS.PAYMENTS_VOID);

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editingDiscount, setEditingDiscount] = useState<AccountDiscount | null>(null);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidingDiscount, setVoidingDiscount] = useState<AccountDiscount | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editMethod, setEditMethod] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ['account-summary', patient.id],
    queryFn: () => patientsApi.accountSummary(patient.id),
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ['patient-treatments', patient.id],
    queryFn: () => patientsApi.treatments(patient.id),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['patient-payments', patient.id],
    queryFn: () => patientsApi.payments(patient.id),
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ['patient-account-discounts', patient.id],
    queryFn: () => patientsApi.accountDiscounts(patient.id),
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodsApi.listActive(),
  });

  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => settingsApi.getClinic(),
  });

  const billedTreatments = useMemo(
    () => treatments.filter((treatment) => treatment.status === 'COMPLETED'),
    [treatments],
  );
  const displayRows = useMemo(() => expandTreatmentDisplayRows(billedTreatments), [billedTreatments]);

  const totals = useMemo(() => {
    if (!summary) return null;
    return {
      subtotalCents: summary.subtotalCents,
      accountDiscountCents: summary.accountDiscountCents,
      totalCostCents: summary.totalCostCents,
      totalPaidCents: summary.totalPaidCents,
      remainingCents: summary.remainingCents,
    };
  }, [summary]);

  function invalidateAccount() {
    queryClient.invalidateQueries({ queryKey: ['account-summary', patient.id] });
    queryClient.invalidateQueries({ queryKey: ['patient-payments', patient.id] });
    queryClient.invalidateQueries({ queryKey: ['patient-account-discounts', patient.id] });
  }

  const updatePaymentMutation = useMutation({
    mutationFn: () =>
      paymentsApi.update(editingPayment!.id, {
        amount: Number(editAmount),
        method: editMethod,
        date: editDate,
        note: editNote.trim() || undefined,
      }),
    onSuccess: () => {
      invalidateAccount();
      setEditingPayment(null);
      setFormError(null);
    },
    onError: (err) => setFormError(getErrorMessage(err, t('common.error'))),
  });

  const updateDiscountMutation = useMutation({
    mutationFn: () =>
      accountDiscountsApi.update(editingDiscount!.id, {
        amount: Number(editAmount),
        date: editDate,
        note: editNote.trim() || undefined,
      }),
    onSuccess: () => {
      invalidateAccount();
      setEditingDiscount(null);
      setFormError(null);
    },
    onError: (err) => setFormError(getErrorMessage(err, t('common.error'))),
  });

  const voidPaymentMutation = useMutation({
    mutationFn: () => paymentsApi.void(voidingPayment!.id, { reason: voidReason.trim() }),
    onSuccess: () => {
      invalidateAccount();
      setVoidingPayment(null);
      setVoidReason('');
      setFormError(null);
    },
    onError: (err) => setFormError(getErrorMessage(err, t('common.error'))),
  });

  const voidDiscountMutation = useMutation({
    mutationFn: () => accountDiscountsApi.void(voidingDiscount!.id, { reason: voidReason.trim() }),
    onSuccess: () => {
      invalidateAccount();
      setVoidingDiscount(null);
      setVoidReason('');
      setFormError(null);
    },
    onError: (err) => setFormError(getErrorMessage(err, t('common.error'))),
  });

  async function handlePrint() {
    if (!totals) return;
    const clinic = await loadClinicPrintInfo();
    print(
      <InvoiceReceiptPrintable
        patient={patient}
        treatments={billedTreatments}
        totals={totals}
        clinic={clinic}
        language={language}
      />,
    );
  }

  function handleWhatsApp() {
    if (!totals) return;
    const message = t('whatsapp.invoiceSummary', {
      clinicName: clinicSettings?.clinicName || t('app.name'),
      patientName: patient.fullName,
      total: formatMoney(totals.totalCostCents),
      paid: formatMoney(totals.totalPaidCents),
      remaining: formatMoney(totals.remainingCents),
    });
    openWhatsApp(patient.phone, message);
  }

  function startEditPayment(payment: Payment) {
    setEditingDiscount(null);
    setEditingPayment(payment);
    setEditAmount(String(centsToAmount(payment.amountCents)));
    setEditMethod(payment.method);
    setEditDate(payment.date);
    setEditNote(payment.note ?? '');
    setFormError(null);
  }

  function startEditDiscount(discount: AccountDiscount) {
    setEditingPayment(null);
    setEditingDiscount(discount);
    setEditAmount(String(centsToAmount(discount.amountCents)));
    setEditDate(discount.date);
    setEditNote(discount.note ?? '');
    setFormError(null);
  }

  const whatsappDisabled = !patient.phone || !totals;

  return (
    <Modal title={t('patientRecord.account.viewInvoice')} icon={<Receipt size={16} />} onClose={onClose} size="wide">
      <div className="invoice-detail">
        {displayRows.length === 0 ? (
          <p className="muted">{t('patientRecord.account.noTreatments')}</p>
        ) : (
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>{t('patientRecord.treatment.columns.date')}</th>
                <th>{t('patientRecord.treatment.columns.treatment')}</th>
                <th>{t('patientRecord.treatment.columns.teeth')}</th>
                <th>{t('patientRecord.treatment.columns.base')}</th>
                <th>{t('patientRecord.treatment.columns.discount')}</th>
                <th>{t('patientRecord.treatment.columns.final')}</th>
                <th>{t('patientRecord.treatment.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const tr = row.treatment;
                const treatmentLabel = t(`patientRecord.treatmentTypes.${tr.treatmentCode}`, {
                  defaultValue: tr.treatmentLabel,
                });
                return (
                  <tr key={row.key}>
                    <td>{formatDateDisplay(tr.treatmentDate ?? tr.createdAt.slice(0, 10), language)}</td>
                    <td>
                      {row.tooth != null
                        ? t('patientRecord.treatment.toothTreatmentLine', {
                            tooth: row.tooth,
                            treatment: treatmentLabel,
                          })
                        : treatmentLabel}
                    </td>
                    <td>
                      {row.tooth != null
                        ? t('patientRecord.treatment.toothLine', { tooth: row.tooth })
                        : tr.teeth.length > 0
                          ? tr.teeth.join(', ')
                          : '—'}
                    </td>
                    <td>{formatMoney(row.baseAmountCents)}</td>
                    <td>{row.discountCents > 0 ? `-${centsToAmount(row.discountCents).toFixed(2)}` : '—'}</td>
                    <td>{formatMoney(row.finalAmountCents)}</td>
                    <td>
                      <span className={`status-chip status-chip--${tr.status.toLowerCase()}`}>
                        {t(`patientRecord.treatmentStatus.${tr.status}`)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

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
                    {p.status === 'VOID'
                      ? t('patientRecord.account.voidLabel', { reason: p.voidReason ?? '' })
                      : p.note || '—'}
                  </td>
                  <td className="payment-history-table__actions">
                    {p.status !== 'VOID' && canEdit && (
                      <button type="button" className="link-btn" onClick={() => startEditPayment(p)}>
                        {t('common.edit')}
                      </button>
                    )}
                    {p.status !== 'VOID' && canVoid && (
                      <button
                        type="button"
                        className="link-btn link-btn--danger"
                        onClick={() => {
                          setVoidingDiscount(null);
                          setVoidingPayment(p);
                          setVoidReason('');
                        }}
                      >
                        {t('patientRecord.account.voidPayment')}
                      </button>
                    )}
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
                    {d.status === 'VOID'
                      ? t('patientRecord.account.voidLabel', { reason: d.voidReason ?? '' })
                      : d.note || '—'}
                  </td>
                  <td className="payment-history-table__actions">
                    {d.status !== 'VOID' && canEdit && (
                      <button type="button" className="link-btn" onClick={() => startEditDiscount(d)}>
                        {t('common.edit')}
                      </button>
                    )}
                    {d.status !== 'VOID' && canVoid && (
                      <button
                        type="button"
                        className="link-btn link-btn--danger"
                        onClick={() => {
                          setVoidingPayment(null);
                          setVoidingDiscount(d);
                          setVoidReason('');
                        }}
                      >
                        {t('patientRecord.account.voidDiscount')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totals && (
          <div className="invoice-detail__totals">
            <div className="treatment-price-breakdown__row">
              <span className="muted">{t('patientRecord.account.subtotal')}</span>
              <span>{formatMoney(totals.subtotalCents)}</span>
            </div>
            <div className="treatment-price-breakdown__row">
              <span className="muted">{t('patientRecord.account.accountDiscount')}</span>
              <span>
                {totals.accountDiscountCents > 0
                  ? `-${formatMoney(totals.accountDiscountCents)}`
                  : formatMoney(0)}
              </span>
            </div>
            <div className="treatment-price-breakdown__row">
              <span className="muted">{t('patientRecord.account.totalCost')}</span>
              <span>{formatMoney(totals.totalCostCents)}</span>
            </div>
            <div className="treatment-price-breakdown__row">
              <span className="muted">{t('patientRecord.account.paid')}</span>
              <span>{formatMoney(totals.totalPaidCents)}</span>
            </div>
            <div className="treatment-price-breakdown__row treatment-price-breakdown__row--final">
              <span>{t('patientRecord.account.remaining')}</span>
              <span>{formatMoney(totals.remainingCents)}</span>
            </div>
          </div>
        )}

        {formError && <div className="form-error-banner">{formError}</div>}

        <div className="form-actions form-actions--start">
          <button type="button" className="btn btn--ghost btn--small" onClick={handlePrint}>
            <Printer size={13} /> {t('patientRecord.account.printReceipt')}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small btn--whatsapp"
            onClick={handleWhatsApp}
            disabled={whatsappDisabled}
            title={!patient.phone ? t('whatsapp.noPhone') ?? '' : ''}
          >
            <MessageCircle size={13} /> {t('whatsapp.sendSummary')}
          </button>
        </div>
      </div>

      {editingPayment && (
        <Modal title={t('patientRecord.account.editPayment')} onClose={() => setEditingPayment(null)}>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.account.amount')}</span>
            <input type="number" min={0.01} step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.account.method')}</span>
            <select value={editMethod} onChange={(e) => setEditMethod(e.target.value)}>
              {paymentMethods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('common.date')}</span>
            <DateField value={editDate} onChange={setEditDate} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('common.note')}</span>
            <input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setEditingPayment(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => updatePaymentMutation.mutate()}
              disabled={updatePaymentMutation.isPending || Number(editAmount) <= 0}
            >
              {t('common.save')}
            </button>
          </div>
        </Modal>
      )}

      {editingDiscount && (
        <Modal title={t('patientRecord.account.editDiscount')} onClose={() => setEditingDiscount(null)}>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.account.discountAmount')}</span>
            <input type="number" min={0.01} step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('common.date')}</span>
            <DateField value={editDate} onChange={setEditDate} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('common.note')}</span>
            <input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setEditingDiscount(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => updateDiscountMutation.mutate()}
              disabled={updateDiscountMutation.isPending || Number(editAmount) <= 0}
            >
              {t('common.save')}
            </button>
          </div>
        </Modal>
      )}

      {(voidingPayment || voidingDiscount) && (
        <Modal
          title={voidingPayment ? t('patientRecord.account.voidPayment') : t('patientRecord.account.voidDiscount')}
          onClose={() => {
            setVoidingPayment(null);
            setVoidingDiscount(null);
            setVoidReason('');
          }}
        >
          <p>
            {voidingPayment
              ? t('patientRecord.account.voidPaymentConfirm')
              : t('patientRecord.account.voidDiscountConfirm')}
          </p>
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.account.voidReason')}</span>
            <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setVoidingPayment(null);
                setVoidingDiscount(null);
                setVoidReason('');
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={voidReason.trim().length < 3 || voidPaymentMutation.isPending || voidDiscountMutation.isPending}
              onClick={() => {
                if (voidingPayment) voidPaymentMutation.mutate();
                else voidDiscountMutation.mutate();
              }}
            >
              {t('patientRecord.account.voidConfirm')}
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
