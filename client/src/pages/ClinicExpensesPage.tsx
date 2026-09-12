import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import { expensesApi, UpdateExpensePayload } from '@/api/expenses.api';
import { expenseCategoriesApi } from '@/api/expense-categories.api';
import { paymentMethodsApi } from '@/api/settings.api';
import { Modal } from '@/components/common/Modal';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { todayIso } from '@/utils/date';
import { DateField } from '@/components/common/DateField';
import { formatMoney, centsToAmount } from '@/utils/money';
import { getErrorMessage } from '@/utils/errors';
import { ClinicExpense, ExpenseCategoryEntity } from '@/types/domain';

type PeriodOption = 'today' | 'month' | 'custom';

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function categoryLabel(categories: ExpenseCategoryEntity[], expense: ClinicExpense): string {
  if (expense.expenseCategoryId) {
    const cat = categories.find((c) => c.id === expense.expenseCategoryId);
    if (cat) return cat.label;
  }
  return String(expense.category);
}

export function ClinicExpensesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canManageExpenses = usePermission(PERMISSIONS.EXPENSES_MANAGE);
  const [period, setPeriod] = useState<PeriodOption>('month');
  const [customFrom, setCustomFrom] = useState(monthStartIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [searchQuery, setSearchQuery] = useState('');
  const [addingExpense, setAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ClinicExpense | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState<number | ''>('');
  const [expenseMethod, setExpenseMethod] = useState('');
  const [expensePaidTo, setExpensePaidTo] = useState('');
  const [expenseNote, setExpenseNote] = useState('');

  const { from, to } = useMemo(() => {
    if (period === 'today') return { from: todayIso(), to: todayIso() };
    if (period === 'month') return { from: monthStartIso(), to: todayIso() };
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo]);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['clinic-expenses', from, to, searchQuery],
    queryFn: () => expensesApi.list(from, to, searchQuery.trim() || undefined),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => expenseCategoriesApi.listActive(),
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodsApi.listActive(),
  });

  const totalCents = useMemo(() => expenses.reduce((sum, e) => sum + e.amountCents, 0), [expenses]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['clinic-expenses'] });
    queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
    queryClient.invalidateQueries({ queryKey: ['reports-expenses'] });
  };

  const createMutation = useMutation({
    mutationFn: expensesApi.create,
    onSuccess: () => {
      invalidate();
      resetForm();
      setAddingExpense(false);
    },
    onError: (err) => setExpenseError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateExpensePayload }) =>
      expensesApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      setEditingExpense(null);
      setExpenseError(null);
    },
    onError: (err) => setExpenseError(getErrorMessage(err, t('common.error'))),
  });

  const deleteMutation = useMutation({
    mutationFn: expensesApi.remove,
    onSuccess: () => {
      invalidate();
      setConfirmDeleteId(null);
    },
    onError: (err) => setExpenseError(getErrorMessage(err, t('common.error'))),
  });

  function resetForm() {
    setExpenseDate(todayIso());
    setExpenseAmount('');
    setExpenseCategoryId(categories[0]?.id ?? '');
    setExpenseMethod(paymentMethods[0]?.code ?? '');
    setExpensePaidTo('');
    setExpenseNote('');
    setExpenseError(null);
  }

  function buildCreatePayload() {
    const amount = Number(expenseAmount);
    if (!amount || amount <= 0) {
      setExpenseError(t('reports.expenses.validation.amountRequired'));
      return null;
    }
    return {
      date: expenseDate,
      amount,
      expenseCategoryId: expenseCategoryId ? Number(expenseCategoryId) : undefined,
      paymentMethod: expenseMethod || paymentMethods[0]?.code || 'CASH',
      paidTo: expensePaidTo.trim() || undefined,
      note: expenseNote.trim() || undefined,
    };
  }

  function handleAddExpense() {
    const payload = buildCreatePayload();
    if (!payload) return;
    createMutation.mutate(payload);
  }

  function openEdit(expense: ClinicExpense) {
    setEditingExpense(expense);
    setExpenseDate(expense.date);
    setExpenseAmount(String(centsToAmount(expense.amountCents)));
    setExpenseCategoryId(expense.expenseCategoryId ?? categories[0]?.id ?? '');
    setExpenseMethod(expense.paymentMethod);
    setExpensePaidTo(expense.paidTo ?? '');
    setExpenseNote(expense.note ?? '');
    setExpenseError(null);
  }

  function handleUpdateExpense() {
    if (!editingExpense) return;
    const amount = Number(expenseAmount);
    if (!amount || amount <= 0) {
      setExpenseError(t('reports.expenses.validation.amountRequired'));
      return;
    }
    updateMutation.mutate({
      id: editingExpense.id,
      payload: {
        date: expenseDate,
        amount,
        expenseCategoryId: expenseCategoryId ? Number(expenseCategoryId) : undefined,
        paymentMethod: expenseMethod,
        paidTo: expensePaidTo.trim() || undefined,
        note: expenseNote.trim() || undefined,
      },
    });
  }

  const formFields = (
    <>
      <label className="form-field">
        <span className="form-field__label">{t('common.date')}</span>
        <DateField value={expenseDate} onChange={setExpenseDate} />
      </label>
      <label className="form-field">
        <span className="form-field__label">{t('reports.expenses.amount')}</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={expenseAmount}
          onChange={(e) => setExpenseAmount(e.target.value)}
          placeholder="0.00"
        />
      </label>
      <label className="form-field">
        <span className="form-field__label">{t('reports.expenses.category')}</span>
        <select
          value={expenseCategoryId}
          onChange={(e) => setExpenseCategoryId(e.target.value ? Number(e.target.value) : '')}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span className="form-field__label">{t('reports.expenses.paidTo')}</span>
        <input
          value={expensePaidTo}
          onChange={(e) => setExpensePaidTo(e.target.value)}
          placeholder={t('reports.expenses.paidToPlaceholder') ?? ''}
        />
      </label>
      <label className="form-field">
        <span className="form-field__label">{t('patientRecord.account.method')}</span>
        <select
          value={expenseMethod || paymentMethods[0]?.code || ''}
          onChange={(e) => setExpenseMethod(e.target.value)}
        >
          {paymentMethods.map((m) => (
            <option key={m.id} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span className="form-field__label">{t('common.note')}</span>
        <input value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} placeholder={t('common.optional') ?? ''} />
      </label>
    </>
  );

  return (
    <div className="reports-page">
      <div className="reports-page__header">
        <h1>{t('nav.clinicExpenses')}</h1>
        <div className="reports-period-group">
          <button
            type="button"
            className={period === 'today' ? 'day-toggle-btn day-toggle-btn--active' : 'day-toggle-btn'}
            onClick={() => setPeriod('today')}
          >
            {t('reports.periods.today')}
          </button>
          <button
            type="button"
            className={period === 'month' ? 'day-toggle-btn day-toggle-btn--active' : 'day-toggle-btn'}
            onClick={() => setPeriod('month')}
          >
            {t('reports.periods.thisMonth')}
          </button>
          <button
            type="button"
            className={period === 'custom' ? 'day-toggle-btn day-toggle-btn--active' : 'day-toggle-btn'}
            onClick={() => setPeriod('custom')}
          >
            {t('reports.periods.custom')}
          </button>
          {period === 'custom' && (
            <span className="reports-custom-range">
              <DateField value={customFrom} onChange={setCustomFrom} />
              <span className="muted">—</span>
              <DateField value={customTo} onChange={setCustomTo} />
            </span>
          )}
        </div>
      </div>

      <section className="settings-section reports-expenses-section">
        <div className="report-detail-header">
          <h2>
            <Receipt size={16} className="reports-section-icon" /> {t('reports.expenses.title')}
          </h2>
          <div className="report-detail-header__actions">
            <label className="expenses-search">
              <Search size={14} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('reports.expenses.searchPlaceholder') ?? ''}
              />
            </label>
            {canManageExpenses && (
              <button
                type="button"
                className="section-card__add-btn"
                title={t('reports.expenses.add') ?? ''}
                onClick={() => {
                  resetForm();
                  setAddingExpense(true);
                }}
              >
                <Plus size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="report-cards">
          <div className="report-card">
            <span className="report-card__value">{formatMoney(totalCents)}</span>
            <span className="report-card__label">{t('reports.expenses.total')}</span>
          </div>
        </div>

        {addingExpense && (
          <div className="expense-add-form">
            {formFields}
            {expenseError && <div className="form-error-banner">{expenseError}</div>}
            <div className="expense-add-form__actions">
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setAddingExpense(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--small"
                onClick={handleAddExpense}
                disabled={createMutation.isPending}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="muted">{t('common.loading')}</p>
        ) : expenses.length === 0 ? (
          <p className="muted">{t('reports.print.noData')}</p>
        ) : (
          <div className="treatment-history-table-wrap">
            <table className="patients-table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('reports.expenses.category')}</th>
                  <th>{t('reports.expenses.paidTo')}</th>
                  <th>{t('reports.expenses.amount')}</th>
                  <th>{t('patientRecord.account.method')}</th>
                  <th>{t('common.note')}</th>
                  {canManageExpenses && <th>{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.date}</td>
                    <td>{categoryLabel(categories, expense)}</td>
                    <td>{expense.paidTo || '—'}</td>
                    <td>{formatMoney(expense.amountCents)}</td>
                    <td>{expense.paymentMethod}</td>
                    <td>{expense.note || '—'}</td>
                    {canManageExpenses && (
                      <td className="catalog-actions">
                        {confirmDeleteId === expense.id ? (
                          <>
                            <span className="muted">{t('reports.expenses.deleteConfirm')}</span>
                            <button
                              type="button"
                              className="btn btn--ghost btn--small btn--danger"
                              onClick={() => deleteMutation.mutate(expense.id)}
                              disabled={deleteMutation.isPending}
                            >
                              {t('common.confirm')}
                            </button>
                            <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmDeleteId(null)}>
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="icon-btn" onClick={() => openEdit(expense)}>
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              onClick={() => setConfirmDeleteId(expense.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!addingExpense && expenseError && <div className="form-error-banner">{expenseError}</div>}
      </section>

      {editingExpense && (
        <Modal title={t('reports.expenses.edit')} icon={<Pencil size={16} />} onClose={() => setEditingExpense(null)}>
          <div className="inline-form">
            {formFields}
            {expenseError && <div className="form-error-banner">{expenseError}</div>}
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setEditingExpense(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleUpdateExpense}
                disabled={updateMutation.isPending}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
