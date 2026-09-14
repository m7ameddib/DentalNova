import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { expensesApi, UpdateExpensePayload } from '@/api/expenses.api';
import { expenseCategoriesApi } from '@/api/expense-categories.api';
import { paymentMethodsApi } from '@/api/settings.api';
import { Modal } from '@/components/common/Modal';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { formatDateDisplay, localMonthStartIso, todayIso } from '@/utils/date';
import { DateField } from '@/components/common/DateField';
import { formatMoney, centsToAmount } from '@/utils/money';
import { getErrorMessage } from '@/utils/errors';
import { ClinicExpense, ExpenseCategoryEntity } from '@/types/domain';
import { useUiStore } from '@/store/ui.store';

type PeriodOption = 'today' | 'month' | 'custom';

function monthStartIso(): string {
  return localMonthStartIso();
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
  const { language } = useUiStore();
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

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of expenses) {
      const label = categoryLabel(categories, expense);
      map.set(label, (map.get(label) ?? 0) + expense.amountCents);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses, categories]);

  function methodLabel(code: string) {
    return paymentMethods.find((m) => m.code === code)?.label ?? code;
  }

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
      <label className="ops-field">
        <span>{t('common.date')}</span>
        <DateField value={expenseDate} onChange={setExpenseDate} />
      </label>
      <label className="ops-field">
        <span>{t('reports.expenses.amount')}</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={expenseAmount}
          onChange={(e) => setExpenseAmount(e.target.value)}
          placeholder="0.00"
        />
      </label>
      <label className="ops-field">
        <span>{t('reports.expenses.category')}</span>
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
      <label className="ops-field">
        <span>{t('reports.expenses.paidTo')}</span>
        <input
          value={expensePaidTo}
          onChange={(e) => setExpensePaidTo(e.target.value)}
          placeholder={t('reports.expenses.paidToPlaceholder') ?? ''}
        />
      </label>
      <label className="ops-field">
        <span>{t('patientRecord.account.method')}</span>
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
      <label className="ops-field">
        <span>{t('common.note')}</span>
        <input value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} placeholder={t('common.optional') ?? ''} />
      </label>
    </>
  );

  return (
    <div className="ops-shell expenses-page">
      <header className="ops-page-head">
        <div className="ops-page-head-copy">
          <h1>{t('nav.clinicExpenses')}</h1>
          <p>{t('reports.expenses.pageHint')}</p>
        </div>
        <div className="ops-page-head-actions">
          {canManageExpenses && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                resetForm();
                setAddingExpense(true);
              }}
            >
              <Plus size={14} /> {t('reports.expenses.add')}
            </button>
          )}
        </div>
      </header>

      <div className="ops-toolbar">
        <div className="ops-seg">
          <button type="button" aria-pressed={period === 'today'} className={period === 'today' ? 'active' : undefined} onClick={() => setPeriod('today')}>
            {t('reports.periods.today')}
          </button>
          <button type="button" aria-pressed={period === 'month'} className={period === 'month' ? 'active' : undefined} onClick={() => setPeriod('month')}>
            {t('reports.periods.thisMonth')}
          </button>
          <button type="button" aria-pressed={period === 'custom'} className={period === 'custom' ? 'active' : undefined} onClick={() => setPeriod('custom')}>
            {t('reports.periods.custom')}
          </button>
        </div>
        {period === 'custom' && (
          <div className="ops-datebar">
            <DateField value={customFrom} onChange={setCustomFrom} />
            <span className="muted">—</span>
            <DateField value={customTo} onChange={setCustomTo} />
          </div>
        )}
        <label className="ops-search">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('reports.expenses.searchPlaceholder') ?? ''}
          />
        </label>
      </div>

      <div className="ops-total-hero">
        <span>{t('reports.expenses.total')}</span>
        <strong className="ops-money">{formatMoney(totalCents)}</strong>
      </div>

      {categoryTotals.length > 1 && (
        <div className="ops-cat-strip" aria-label={t('reports.expenses.byCategory')}>
          {categoryTotals.slice(0, 6).map(([label, cents]) => (
            <div key={label} className="ops-cat-chip">
              <span>{label}</span>
              <strong className="ops-money">{formatMoney(cents)}</strong>
            </div>
          ))}
        </div>
      )}

      {addingExpense && (
        <div className="ops-panel">
          <h3>{t('reports.expenses.add')}</h3>
          <div className="ops-form-grid">{formFields}</div>
          {expenseError && <div className="ops-banner is-warn">{expenseError}</div>}
          <div className="ops-row-actions">
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
        <div className="ops-empty">
          <strong>{t('reports.expenses.emptyTitle')}</strong>
          <p>{t('reports.expenses.emptyHint')}</p>
          {canManageExpenses && (
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => {
                resetForm();
                setAddingExpense(true);
              }}
            >
              {t('reports.expenses.add')}
            </button>
          )}
        </div>
      ) : (
        <div className="ops-worklist">
          <div className={`ops-worklist-head ${canManageExpenses ? 'exp-cols' : 'exp-cols-ro'}`}>
            <span>{t('common.date')}</span>
            <span>{t('reports.expenses.category')}</span>
            <span>{t('reports.expenses.paidTo')}</span>
            <span>{t('reports.expenses.amount')}</span>
            <span>{t('patientRecord.account.method')}</span>
            <span>{t('common.note')}</span>
            {canManageExpenses && <span>{t('common.actions')}</span>}
          </div>
          {expenses.map((expense) => (
            <div key={expense.id} className={`ops-work-row is-static ${canManageExpenses ? 'exp-cols' : 'exp-cols-ro'}`}>
              <span data-label={t('common.date')}>{formatDateDisplay(expense.date, language)}</span>
              <strong data-label={t('reports.expenses.category')}>{categoryLabel(categories, expense)}</strong>
              <span className="ops-meta" data-label={t('reports.expenses.paidTo')}>
                {expense.paidTo || '—'}
              </span>
              <span className="ops-money" data-label={t('reports.expenses.amount')}>
                {formatMoney(expense.amountCents)}
              </span>
              <span data-label={t('patientRecord.account.method')}>{methodLabel(expense.paymentMethod)}</span>
              <span className="ops-meta" data-label={t('common.note')}>
                {expense.note || '—'}
              </span>
              {canManageExpenses && (
                <div className="ops-row-actions" data-label={t('common.actions')}>
                  {confirmDeleteId === expense.id ? (
                    <>
                      <span className="ops-meta">{t('reports.expenses.deleteConfirm')}</span>
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
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => openEdit(expense)}>
                        <Pencil size={14} /> {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--small btn--danger"
                        onClick={() => setConfirmDeleteId(expense.id)}
                      >
                        <Trash2 size={14} /> {t('common.delete')}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!addingExpense && expenseError && <div className="ops-banner is-warn">{expenseError}</div>}

      {editingExpense && (
        <Modal title={t('reports.expenses.edit')} icon={<Pencil size={16} />} onClose={() => setEditingExpense(null)}>
          <div className="ops-form-grid">{formFields}</div>
          {expenseError && <div className="ops-banner is-warn">{expenseError}</div>}
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
        </Modal>
      )}
    </div>
  );
}
