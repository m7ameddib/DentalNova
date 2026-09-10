import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, Receipt, History, Printer, MessageCircle, Percent } from 'lucide-react';
import { SectionCard } from '@/components/common/SectionCard';
import { FormField } from '@/components/common/FormField';
import { InvoiceDetailsModal } from './InvoiceDetailsModal';
import { PaymentHistoryModal } from './PaymentHistoryModal';
import { PaymentReceiptPrintable, AccountStatementPrintable } from './PrintableTemplates';
import { patientsApi } from '@/api/patients.api';
import { paymentsApi } from '@/api/payments.api';
import { accountDiscountsApi } from '@/api/accountDiscounts.api';
import { paymentMethodsApi, settingsApi } from '@/api/settings.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { formatMoney } from '@/utils/money';
import { todayIso } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import { useUiStore } from '@/store/ui.store';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { openWhatsApp } from '@/utils/whatsapp';
import { Patient, Payment } from '@/types/domain';

type AccountAddMode = 'payment' | 'discount' | null;

export function AccountSection({ patientId, patient }: { patientId: number; patient: Patient }) {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const queryClient = useQueryClient();
  const print = usePrintStore((s) => s.print);
  const canCreate = usePermission(PERMISSIONS.PAYMENTS_CREATE);

  const [addMode, setAddMode] = useState<AccountAddMode>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState<Payment | null>(null);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ['account-summary', patientId],
    queryFn: () => patientsApi.accountSummary(patientId),
  });

  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodsApi.listActive(),
  });

  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => settingsApi.getClinic(),
  });

  useEffect(() => {
    if (methods.length > 0 && !method) {
      setMethod(methods.find((m) => m.code === 'CASH')?.code ?? methods[0].code);
    }
  }, [methods, method]);

  const createPaymentMutation = useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ['account-summary', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-payments', patientId] });
      const methodLabel = methods.find((m) => m.code === payment.method)?.label;
      setJustPaid({ ...payment, methodLabel });
      resetForm();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const createDiscountMutation = useMutation({
    mutationFn: accountDiscountsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-summary', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-account-discounts', patientId] });
      resetForm();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function resetForm() {
    setAddMode(null);
    setAmount('');
    setMethod(methods.find((m) => m.code === 'CASH')?.code ?? methods[0]?.code ?? '');
    setDate(todayIso());
    setNote('');
    setError(null);
  }

  function openAdd(mode: AccountAddMode) {
    setJustPaid(null);
    setAddMode(mode);
    setAmount('');
    setDate(todayIso());
    setNote('');
    setError(null);
  }

  function handleSavePayment() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError(t('patientRecord.account.validation.amountRequired'));
      return;
    }
    if (!method) {
      setError(t('patientRecord.account.validation.methodRequired'));
      return;
    }
    createPaymentMutation.mutate({
      patientId,
      amount: value,
      method,
      date,
      note: note.trim() || undefined,
    });
  }

  function handleSaveDiscount() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError(t('patientRecord.account.validation.discountAmountRequired'));
      return;
    }
    createDiscountMutation.mutate({
      patientId,
      amount: value,
      date,
      note: note.trim() || undefined,
    });
  }

  async function handlePrintReceipt(payment: Payment) {
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
    const message = t('whatsapp.paymentReceipt', {
      clinicName: clinicSettings?.clinicName || t('app.name'),
      patientName: patient.fullName,
      amount: formatMoney(payment.amountCents),
      date: payment.date,
      remaining: formatMoney(summary?.remainingCents ?? 0),
    });
    openWhatsApp(patient.phone, message);
  }

  function handleBalanceReminder() {
    if (!summary) return;
    const message = t('whatsapp.balanceReminder', {
      clinicName: clinicSettings?.clinicName || t('app.name'),
      patientName: patient.fullName,
      remaining: formatMoney(summary.remainingCents),
    });
    openWhatsApp(patient.phone, message);
  }

  async function handlePrintStatement() {
    if (!summary) return;
    const clinic = await loadClinicPrintInfo();
    const [treatments, payments] = await Promise.all([
      patientsApi.treatments(patientId),
      patientsApi.payments(patientId),
    ]);
    print(
      <AccountStatementPrintable
        patient={patient}
        treatments={treatments.filter((treatment) => treatment.status === 'COMPLETED')}
        payments={payments}
        totals={summary}
        clinic={clinic}
        language={language}
      />,
    );
  }

  const whatsappDisabled = !patient.phone;
  const savePending = createPaymentMutation.isPending || createDiscountMutation.isPending;

  return (
    <SectionCard
      title={t('patientRecord.sections.account')}
      icon={<Wallet size={16} />}
      onAdd={
        canCreate
          ? () => {
              if (addMode === 'payment') resetForm();
              else openAdd('payment');
            }
          : undefined
      }
      addTitle={t('patientRecord.account.addTitle') ?? ''}
      headerExtra={
        canCreate ? (
          <button
            type="button"
            className="section-card__add-btn section-card__add-btn--secondary"
            title={t('patientRecord.account.addDiscountTitle') ?? ''}
            onClick={() => {
              if (addMode === 'discount') resetForm();
              else openAdd('discount');
            }}
          >
            <Percent size={14} />
          </button>
        ) : undefined
      }
      className="section-card--account"
    >
      {!addMode && summary && (
        <div className="account-summary">
          <div className="account-summary__row">
            <span className="muted">{t('patientRecord.account.subtotal')}</span>
            <span>{formatMoney(summary.subtotalCents)}</span>
          </div>
          <div className="account-summary__row account-summary__row--discount">
            <span className="muted">{t('patientRecord.account.accountDiscount')}</span>
            <span>
              {summary.accountDiscountCents > 0
                ? `-${formatMoney(summary.accountDiscountCents)}`
                : formatMoney(0)}
            </span>
          </div>
          <div className="account-summary__row account-summary__row--total">
            <span>{t('patientRecord.account.totalCost')}</span>
            <span>{formatMoney(summary.totalCostCents)}</span>
          </div>
          <div className="account-summary__row">
            <span className="muted">{t('patientRecord.account.totalPaid')}</span>
            <span>{formatMoney(summary.totalPaidCents)}</span>
          </div>
          <div className="account-summary__row account-summary__row--balance">
            <span>{t('patientRecord.account.remaining')}</span>
            <span>{formatMoney(summary.remainingCents)}</span>
          </div>

          {justPaid && (
            <div className="payment-confirm-banner">
              <span className="muted">{t('patientRecord.account.paymentSaved')}</span>
              <div className="payment-confirm-banner__actions">
                <button type="button" className="link-btn" onClick={() => handlePrintReceipt(justPaid)}>
                  <Printer size={12} /> {t('patientRecord.account.printReceipt')}
                </button>
                <button
                  type="button"
                  className="link-btn"
                  disabled={whatsappDisabled}
                  onClick={() => handleWhatsAppReceipt(justPaid)}
                >
                  <MessageCircle size={12} /> {t('whatsapp.sendReceipt')}
                </button>
                <button type="button" className="link-btn" onClick={() => setJustPaid(null)}>
                  {t('common.close')}
                </button>
              </div>
            </div>
          )}

          <div className="account-summary__payments">
            <span className="muted">{t('patientRecord.account.lastPayments')}</span>
            {summary.lastPayments.length === 0 ? (
              <p className="muted">{t('patientRecord.account.noPayments')}</p>
            ) : (
              <ul>
                {summary.lastPayments.map((p) => (
                  <li key={p.id}>
                    <span>{p.date}</span>
                    <span>{formatMoney(p.amountCents)}</span>
                    <span className="muted">{p.methodLabel ?? p.method}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="account-summary__payments">
            <span className="muted">{t('patientRecord.account.lastDiscounts')}</span>
            {(summary.lastDiscounts ?? []).length === 0 ? (
              <p className="muted">{t('patientRecord.account.noDiscounts')}</p>
            ) : (
              <ul>
                {(summary.lastDiscounts ?? []).map((d) => (
                  <li key={d.id}>
                    <span>{d.date}</span>
                    <span>-{formatMoney(d.amountCents)}</span>
                    <span className="muted">{d.note || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="account-summary__links">
            <button type="button" className="link-btn" onClick={() => setShowInvoiceModal(true)}>
              <Receipt size={13} /> {t('patientRecord.account.viewInvoice')}
            </button>
            <button type="button" className="link-btn" onClick={() => setShowHistoryModal(true)}>
              <History size={13} /> {t('patientRecord.account.viewHistory')}
            </button>
          </div>

          <div className="account-summary__links">
            <button type="button" className="link-btn" onClick={handlePrintStatement}>
              <Printer size={13} /> {t('statement.printAction')}
            </button>
            {summary.remainingCents > 0 && (
              <button
                type="button"
                className="link-btn link-btn--whatsapp"
                disabled={whatsappDisabled}
                onClick={handleBalanceReminder}
                title={whatsappDisabled ? t('whatsapp.noPhone') ?? '' : ''}
              >
                <MessageCircle size={13} /> {t('whatsapp.sendBalanceReminder')}
              </button>
            )}
          </div>
        </div>
      )}

      {addMode === 'payment' && (
        <div className="inline-form">
          <FormField label={t('patientRecord.account.amount')} required>
            <input
              type="number"
              min={0}
              step="0.01"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormField>

          <FormField label={t('patientRecord.account.method')}>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {methods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code === 'CASH' ? t('patientRecord.paymentMethod.CASH') : m.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t('patientRecord.account.date')}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>

          <FormField label={t('patientRecord.account.note')}>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('patientRecord.account.notePlaceholder') ?? ''}
            />
          </FormField>

          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={resetForm}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSavePayment}
              disabled={savePending}
            >
              {t('patientRecord.account.save')}
            </button>
          </div>
        </div>
      )}

      {addMode === 'discount' && (
        <div className="inline-form">
          <FormField label={t('patientRecord.account.discountAmount')} required>
            <input
              type="number"
              min={0}
              step="0.01"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormField>

          <FormField label={t('patientRecord.account.date')}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>

          <FormField label={t('patientRecord.account.note')}>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('patientRecord.account.discountNotePlaceholder') ?? ''}
            />
          </FormField>

          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={resetForm}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSaveDiscount}
              disabled={savePending}
            >
              {t('patientRecord.account.saveDiscount')}
            </button>
          </div>
        </div>
      )}

      {showInvoiceModal && <InvoiceDetailsModal patient={patient} onClose={() => setShowInvoiceModal(false)} />}
      {showHistoryModal && <PaymentHistoryModal patient={patient} onClose={() => setShowHistoryModal(false)} />}
    </SectionCard>
  );
}
