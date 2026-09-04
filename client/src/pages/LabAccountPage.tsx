import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Printer, Wallet } from 'lucide-react';
import { labCasesApi } from '@/api/lab-cases.api';
import { paymentMethodsApi } from '@/api/settings.api';
import { Modal } from '@/components/common/Modal';
import { LabStatementPrintable } from '@/components/lab-accounts/LabStatementPrintable';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { usePrintStore } from '@/store/print.store';
import { useUiStore } from '@/store/ui.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { todayIso, formatDateDisplay } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { getErrorMessage } from '@/utils/errors';
import type { LabAccountPaymentRow } from '@/types/domain';

export function LabAccountPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const print = usePrintStore((s) => s.print);
  const { language } = useUiStore();
  const canPay = usePermission(PERMISSIONS.LAB_PAYMENTS_RECORD);
  const canVoid = usePermission(PERMISSIONS.LAB_PAYMENTS_VOID);

  const labId = id ? Number(id) : null;
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFrom, setAppliedFrom] = useState<string | undefined>();
  const [appliedTo, setAppliedTo] = useState<string | undefined>();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [payDate, setPayDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<LabAccountPaymentRow | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMethod, setEditMethod] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');

  const [voiding, setVoiding] = useState<LabAccountPaymentRow | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const { data: accounts = [] } = useQuery({
    queryKey: ['lab-accounts'],
    queryFn: () => labCasesApi.listLabAccounts(),
  });

  const { data: summary } = useQuery({
    queryKey: ['lab-account', labId, appliedFrom, appliedTo],
    queryFn: () => labCasesApi.getLabAccount(labId!, appliedFrom, appliedTo),
    enabled: !!labId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['lab-account-orders', labId, appliedFrom, appliedTo],
    queryFn: () => labCasesApi.listLabAccountOrders(labId!, appliedFrom, appliedTo),
    enabled: !!labId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['lab-account-payments', labId, appliedFrom, appliedTo],
    queryFn: () => labCasesApi.listLabAccountPayments(labId!, appliedFrom, appliedTo),
    enabled: !!labId && canPay,
  });

  const { data: statement = [] } = useQuery({
    queryKey: ['lab-account-statement', labId, appliedFrom, appliedTo],
    queryFn: () => labCasesApi.getLabStatement(labId!, appliedFrom, appliedTo),
    enabled: !!labId && canPay,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodsApi.listActive(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lab-accounts'] });
    if (!labId) return;
    queryClient.invalidateQueries({ queryKey: ['lab-account', labId] });
    queryClient.invalidateQueries({ queryKey: ['lab-account-orders', labId] });
    queryClient.invalidateQueries({ queryKey: ['lab-account-payments', labId] });
    queryClient.invalidateQueries({ queryKey: ['lab-account-statement', labId] });
  };

  const recordMutation = useMutation({
    mutationFn: () =>
      labCasesApi.recordLabAccountPayment(labId!, {
        amount: Number(amount),
        paymentMethod: method || paymentMethods[0]?.code || 'CASH',
        paymentDate: payDate,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setAmount('');
      setNote('');
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      labCasesApi.updateLabAccountPayment(labId!, editing!.id, {
        amount: Number(editAmount),
        paymentMethod: editMethod,
        paymentDate: editDate,
        note: editNote.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const voidMutation = useMutation({
    mutationFn: ({ payment }: { payment: LabAccountPaymentRow }) => {
      if (payment.source === 'LAB') {
        return labCasesApi.voidLabAccountPayment(labId!, payment.id, voidReason);
      }
      return labCasesApi.voidPayment(payment.labCaseId!, payment.id, voidReason);
    },
    onSuccess: () => {
      invalidate();
      setVoiding(null);
      setVoidReason('');
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.labName.localeCompare(b.labName)),
    [accounts],
  );

  function applyFilter() {
    setAppliedFrom(fromDate || undefined);
    setAppliedTo(toDate || undefined);
  }

  function clearFilter() {
    setFromDate('');
    setToDate('');
    setAppliedFrom(undefined);
    setAppliedTo(undefined);
  }

  function openEdit(payment: LabAccountPaymentRow) {
    setEditing(payment);
    setEditAmount(String(payment.amountCents / 100));
    setEditMethod(payment.paymentMethod);
    setEditDate(payment.paymentDate);
    setEditNote(payment.note ?? '');
    setError(null);
  }

  async function handlePrintStatement() {
    if (!summary) return;
    const clinic = await loadClinicPrintInfo();
    print(
      <LabStatementPrintable
        labName={summary.labName}
        summary={summary}
        orders={orders}
        payments={payments.filter((p) => p.status !== 'VOID')}
        statement={statement}
        clinic={clinic}
        language={language}
      />,
    );
  }

  if (!labId) {
    return (
      <div className="lab-account-page">
        <div className="lab-account-page__header">
          <h1>
            <Wallet size={22} /> {t('labCases.accounts.title')}
          </h1>
        </div>
        <table className="patients-table">
          <thead>
            <tr>
              <th>{t('labCases.labName')}</th>
              <th>{t('labCases.accounts.total')}</th>
              <th>{t('labCases.accounts.paid')}</th>
              <th>{t('labCases.accounts.remaining')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedAccounts.map((row) => (
              <tr key={row.labNameId}>
                <td>
                  <Link to={`/lab-accounts/${row.labNameId}`} className="link-btn">
                    {row.labName}
                  </Link>
                </td>
                <td>{formatMoney(row.totalCents)}</td>
                <td>{formatMoney(row.paidCents)}</td>
                <td>{formatMoney(row.remainingCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedAccounts.length === 0 && <p className="muted">{t('labCases.accounts.selectLab')}</p>}
      </div>
    );
  }

  return (
    <div className="lab-account-page">
      <div className="lab-account-page__header">
        <h1>
          <FlaskConical size={22} /> {t('labCases.accounts.accountTitle', { name: summary?.labName ?? '…' })}
        </h1>
        <div className="lab-account-page__header-actions">
          <select
            className="lab-account-page__lab-select"
            value={labId}
            onChange={(e) => navigate(`/lab-accounts/${e.target.value}`)}
          >
            {sortedAccounts.map((row) => (
              <option key={row.labNameId} value={row.labNameId}>
                {row.labName}
              </option>
            ))}
          </select>
          {canPay && (
            <button type="button" className="btn btn--ghost btn--small" onClick={handlePrintStatement}>
              <Printer size={14} /> {t('labCases.accounts.printStatement')}
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div className="lab-account-summary">
          <div className="lab-account-summary__card">
            <span className="muted">{t('labCases.accounts.total')}</span>
            <strong>{formatMoney(summary.totalCents)}</strong>
          </div>
          <div className="lab-account-summary__card">
            <span className="muted">{t('labCases.accounts.paid')}</span>
            <strong>{formatMoney(summary.paidCents)}</strong>
          </div>
          <div className="lab-account-summary__card lab-account-summary__card--balance">
            <span className="muted">{t('labCases.accounts.remaining')}</span>
            <strong>{formatMoney(summary.remainingCents)}</strong>
          </div>
        </div>
      )}

      <div className="lab-account-filters inline-form">
        <label className="form-field">
          <span className="form-field__label">{t('labCases.accounts.dateFrom')}</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label className="form-field">
          <span className="form-field__label">{t('labCases.accounts.dateTo')}</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <button type="button" className="btn btn--ghost btn--small" onClick={applyFilter}>
          {t('labCases.accounts.applyFilter')}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={clearFilter}>
          {t('labCases.accounts.clearFilter')}
        </button>
      </div>

      <section className="lab-account-section">
        <h2>{t('labCases.accounts.orders')}</h2>
        {orders.length === 0 ? (
          <p className="muted">{t('labCases.accounts.noOrders')}</p>
        ) : (
          <table className="patients-table">
            <thead>
              <tr>
                <th>{t('labCases.accounts.orderDate')}</th>
                <th>{t('labCases.accounts.patient')}</th>
                <th>{t('labCases.accounts.workType')}</th>
                <th>{t('labCases.accounts.cost')}</th>
                <th>{t('labCases.status')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{formatDateDisplay(o.sentDate ?? o.createdAt.slice(0, 10), language)}</td>
                  <td>
                    {o.patientName} <span className="muted">({o.patientFileNumber})</span>
                  </td>
                  <td>{o.workTypeLabel}</td>
                  <td>{formatMoney(o.labCostCents)}</td>
                  <td>{t(`labCases.statuses.${o.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {canPay && (
        <>
          <section className="lab-account-section">
            <h2>{t('labCases.accounts.payments')}</h2>
            {payments.length === 0 ? (
              <p className="muted">{t('labCases.accounts.noPayments')}</p>
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
                    <tr key={`${p.source}-${p.id}`} className={p.status === 'VOID' ? 'payment-row--void' : undefined}>
                      <td>{p.paymentDate}</td>
                      <td>{formatMoney(p.amountCents)}</td>
                      <td>{p.paymentMethod}</td>
                      <td className="muted">
                        {p.status === 'VOID'
                          ? p.voidReason
                          : p.source === 'CASE'
                            ? `${t('labCases.accounts.sourceCase')} #${p.labCaseId} — ${p.patientName}`
                            : p.note || '—'}
                      </td>
                      <td>
                        {p.status !== 'VOID' && p.editable && (
                          <button type="button" className="link-btn" onClick={() => openEdit(p)}>
                            {t('common.edit')}
                          </button>
                        )}
                        {p.status !== 'VOID' && canVoid && (
                          <button type="button" className="link-btn link-btn--danger" onClick={() => setVoiding(p)}>
                            {t('labCases.financial.voidPayment')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {summary && summary.remainingCents > 0 && (
              <div className="inline-form lab-case-payment-form">
                <h3>{t('labCases.accounts.addPayment')}</h3>
                <label className="form-field">
                  <span className="form-field__label">{t('patientRecord.account.amount')}</span>
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-field__label">{t('patientRecord.account.method')}</span>
                  <select value={method || paymentMethods[0]?.code || ''} onChange={(e) => setMethod(e.target.value)}>
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.code}>
                        {m.label}
                      </option>
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
                <button
                  type="button"
                  className="btn btn--primary btn--small"
                  onClick={() => recordMutation.mutate()}
                  disabled={recordMutation.isPending || !amount}
                >
                  {t('labCases.financial.recordPayment')}
                </button>
              </div>
            )}
          </section>

          <section className="lab-account-section">
            <h2>{t('labCases.accounts.statement')}</h2>
            {statement.length === 0 ? (
              <p className="muted">{t('labCases.accounts.noStatement')}</p>
            ) : (
              <table className="patients-table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('labCases.accounts.description')}</th>
                    <th>{t('labCases.accounts.debit')}</th>
                    <th>{t('labCases.accounts.credit')}</th>
                    <th>{t('labCases.accounts.balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.map((line, i) => (
                    <tr key={i}>
                      <td>{formatDateDisplay(line.date, language)}</td>
                      <td>{line.description}</td>
                      <td>{line.debitCents > 0 ? formatMoney(line.debitCents) : '—'}</td>
                      <td>{line.creditCents > 0 ? formatMoney(line.creditCents) : '—'}</td>
                      <td>{formatMoney(line.balanceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {error && <div className="form-error-banner">{error}</div>}

      {editing && (
        <Modal title={t('labCases.accounts.editPayment')} onClose={() => setEditing(null)}>
          <div className="inline-form">
            <label className="form-field">
              <span className="form-field__label">{t('patientRecord.account.amount')}</span>
              <input type="number" min="0" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </label>
            <label className="form-field">
              <span className="form-field__label">{t('patientRecord.account.method')}</span>
              <select value={editMethod} onChange={(e) => setEditMethod(e.target.value)}>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-field__label">{t('common.date')}</span>
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </label>
            <label className="form-field">
              <span className="form-field__label">{t('common.note')}</span>
              <input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !editAmount}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {voiding && (
        <Modal title={t('labCases.financial.voidPayment')} onClose={() => setVoiding(null)}>
          <p>{t('labCases.accounts.voidConfirm')}</p>
          <label className="form-field">
            <span className="form-field__label">{t('labCases.financial.voidReason')}</span>
            <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setVoiding(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => voiding && voidMutation.mutate({ payment: voiding })}
              disabled={voidMutation.isPending || voidReason.trim().length < 3}
            >
              {t('common.confirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
