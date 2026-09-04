import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Printer } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { reportsApi } from '@/api/reports.api';
import { expensesApi } from '@/api/expenses.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { useUiStore } from '@/store/ui.store';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { formatDateDisplay, formatDateTimeDisplay } from '@/utils/date';
import { centsToAmount, formatMoney } from '@/utils/money';
import { expandTreatmentDisplayRows } from '@/utils/treatment-display';
import { getErrorMessage } from '@/utils/errors';
import { ReportPrintable } from './ReportPrintable';
import { AppointmentStatus, FinancialSummary } from '@/types/domain';

export type ReportDetailSpec =
  | { kind: 'treatments'; onlyDiscounted: boolean }
  | { kind: 'payments' }
  | { kind: 'outstanding' }
  | { kind: 'debts' }
  | { kind: 'expenses' }
  | { kind: 'netCash' }
  | { kind: 'appointments'; status?: AppointmentStatus }
  | { kind: 'patients'; onlyNew: boolean };

interface ReportDetailModalProps {
  detail: ReportDetailSpec;
  from: string;
  to: string;
  periodLabel: string;
  financial?: FinancialSummary;
  onClose: () => void;
}

export function ReportDetailModal({ detail, from, to, periodLabel, financial, onClose }: ReportDetailModalProps) {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const queryClient = useQueryClient();
  const print = usePrintStore((s) => s.print);
  const canManageExpenses = usePermission(PERMISSIONS.EXPENSES_MANAGE);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const treatmentsQuery = useQuery({
    queryKey: ['reports-treatments', from, to, detail.kind === 'treatments' ? detail.onlyDiscounted : false],
    queryFn: () => reportsApi.treatments(from, to, detail.kind === 'treatments' ? detail.onlyDiscounted : false),
    enabled: detail.kind === 'treatments',
  });
  const paymentsQuery = useQuery({
    queryKey: ['reports-payments', from, to],
    queryFn: () => reportsApi.payments(from, to),
    enabled: detail.kind === 'payments',
  });
  const outstandingQuery = useQuery({
    queryKey: ['reports-outstanding'],
    queryFn: () => reportsApi.outstanding(),
    enabled: detail.kind === 'outstanding',
  });
  const debtsQuery = useQuery({
    queryKey: ['reports-debts'],
    queryFn: () => reportsApi.debts(),
    enabled: detail.kind === 'debts',
  });
  const expensesQuery = useQuery({
    queryKey: ['reports-expenses', from, to],
    queryFn: () => expensesApi.list(from, to),
    enabled: detail.kind === 'expenses' || detail.kind === 'netCash',
  });
  const appointmentsQuery = useQuery({
    queryKey: ['reports-appointments', from, to, detail.kind === 'appointments' ? detail.status : undefined],
    queryFn: () => reportsApi.appointments(from, to, detail.kind === 'appointments' ? detail.status : undefined),
    enabled: detail.kind === 'appointments',
  });
  const patientsQuery = useQuery({
    queryKey: ['reports-patients', from, to, detail.kind === 'patients' ? detail.onlyNew : false],
    queryFn: () => reportsApi.patients(from, to, detail.kind === 'patients' ? detail.onlyNew : false),
    enabled: detail.kind === 'patients',
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: number) => expensesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
      setConfirmDeleteId(null);
      setDeleteError(null);
    },
    onError: (err) => setDeleteError(getErrorMessage(err, t('common.error'))),
  });

  let title = '';
  let columns: string[] = [];
  let rows: (string | number)[][] = [];
  let printRows: (string | number)[][] = [];
  let totals: { label: string; value: string }[] | undefined;
  let bodyContent: React.ReactNode = null;

  if (detail.kind === 'treatments') {
    title = t(detail.onlyDiscounted ? 'reports.detail.discountsTitle' : 'reports.detail.treatmentsTitle');
    columns = [
      t('common.date'),
      t('receipt.patient'),
      t('patientRecord.treatment.columns.treatment'),
      t('patientRecord.treatment.columns.teeth'),
      t('patientRecord.treatment.columns.base'),
      t('patientRecord.treatment.columns.discount'),
      t('patientRecord.treatment.columns.final'),
    ];
    const data = treatmentsQuery.data ?? [];
    const expanded = data.flatMap((tr) =>
      expandTreatmentDisplayRows([tr]).map((row) => ({ ...row, patientName: tr.patientName })),
    );
    rows = expanded.map((row) => {
      const treatmentLabel = t(`patientRecord.treatmentTypes.${row.treatment.treatmentCode}`, {
        defaultValue: row.treatment.treatmentLabel,
      });
      return [
        formatDateTimeDisplay(row.treatment.createdAt, language),
        row.patientName,
        row.tooth != null
          ? t('patientRecord.treatment.toothTreatmentLine', {
              tooth: row.tooth,
              treatment: treatmentLabel,
            })
          : treatmentLabel,
        row.tooth != null
          ? t('patientRecord.treatment.toothLine', { tooth: row.tooth })
          : row.treatment.teeth.length > 0
            ? row.treatment.teeth.join(', ')
            : '—',
        formatMoney(row.baseAmountCents),
        row.discountCents > 0 ? `-${centsToAmount(row.discountCents).toFixed(2)}` : '—',
        formatMoney(row.finalAmountCents),
      ];
    });
    printRows = rows;
    const totalBase = data.reduce((s, tr) => s + tr.baseAmountCents, 0);
    const totalDiscount = data.reduce((s, tr) => s + tr.discountCents, 0);
    const totalFinal = data.reduce((s, tr) => s + tr.finalAmountCents, 0);
    totals = [
      { label: t('patientRecord.treatment.columns.base'), value: formatMoney(totalBase) },
      { label: t('patientRecord.treatment.columns.discount'), value: formatMoney(totalDiscount) },
      { label: t('patientRecord.treatment.columns.final'), value: formatMoney(totalFinal) },
    ];
  } else if (detail.kind === 'payments') {
    title = t('reports.detail.paymentsTitle');
    columns = [t('common.date'), t('receipt.patient'), t('patientRecord.account.amount'), t('patientRecord.account.method'), t('common.note')];
    const data = paymentsQuery.data ?? [];
    rows = data.map((p) => [
      formatDateDisplay(p.date, language),
      p.patientName,
      formatMoney(p.amountCents),
      p.methodLabel ?? p.method,
      p.note || '—',
    ]);
    printRows = rows;
    totals = [{ label: t('reports.financial.totalCollected'), value: formatMoney(data.reduce((s, p) => s + p.amountCents, 0)) }];
  } else if (detail.kind === 'outstanding') {
    title = t('reports.detail.outstandingTitle');
    columns = [
      t('receipt.patient'),
      t('receipt.fileNumber'),
      t('patientRecord.patient.phone'),
      t('receipt.invoiceTotal'),
      t('receipt.paid'),
      t('receipt.remaining'),
    ];
    const data = outstandingQuery.data ?? [];
    rows = data.map((p) => [
      p.fullName,
      p.fileNumber,
      p.phone,
      formatMoney(p.totalCostCents),
      formatMoney(p.totalPaidCents),
      formatMoney(p.remainingCents),
    ]);
    printRows = rows;
    totals = [{ label: t('reports.financial.outstandingBalance'), value: formatMoney(data.reduce((s, p) => s + p.remainingCents, 0)) }];
  } else if (detail.kind === 'debts') {
    title = t('reports.detail.debtsTitle');
    columns = [
      t('receipt.patient'),
      t('patientRecord.patient.phone'),
      t('receipt.invoiceTotal'),
      t('receipt.paid'),
      t('receipt.remaining'),
      t('followUp.lastPayment'),
      t('followUp.actions.nextDate'),
    ];
    const data = debtsQuery.data ?? [];
    rows = data.map((p) => [
      p.fullName,
      p.phone,
      formatMoney(p.totalCostCents),
      formatMoney(p.totalPaidCents),
      formatMoney(p.remainingCents),
      p.lastPaymentDate
        ? `${formatDateDisplay(p.lastPaymentDate, language)}${p.lastPaymentAmountCents ? ` (${formatMoney(p.lastPaymentAmountCents)})` : ''}`
        : '—',
      p.nextFollowUpDate ? formatDateDisplay(p.nextFollowUpDate, language) : '—',
    ]);
    printRows = rows;
    totals = [{ label: t('reports.financial.outstandingDebts'), value: formatMoney(data.reduce((s, p) => s + p.remainingCents, 0)) }];
  } else if (detail.kind === 'expenses') {
    title = t('reports.expenses.title');
    columns = [
      t('common.date'),
      t('reports.expenses.category'),
      t('reports.expenses.amount'),
      t('patientRecord.account.method'),
      t('common.note'),
      ...(canManageExpenses ? [t('common.actions')] : []),
    ];
    const data = expensesQuery.data ?? [];
    printRows = data.map((e) => [
      formatDateDisplay(e.date, language),
      t(`reports.expenses.categories.${e.category}`, { defaultValue: e.category }),
      formatMoney(e.amountCents),
      e.paymentMethod,
      e.note || '—',
    ]);
    totals = [{ label: t('reports.expenses.title'), value: formatMoney(data.reduce((s, e) => s + e.amountCents, 0)) }];
    bodyContent = (
      <>
        {data.length === 0 ? (
          <p className="muted">{t('reports.print.noData')}</p>
        ) : (
          <table className="payment-history-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td>{formatDateDisplay(e.date, language)}</td>
                  <td>{t(`reports.expenses.categories.${e.category}`, { defaultValue: e.category })}</td>
                  <td>{formatMoney(e.amountCents)}</td>
                  <td>{e.paymentMethod}</td>
                  <td className="muted">{e.note || '—'}</td>
                  {canManageExpenses && (
                    <td className="payment-history-table__actions">
                      {confirmDeleteId === e.id ? (
                        <span className="treatment-history__confirm">
                          <span className="muted">{t('reports.expenses.deleteConfirm')}</span>
                          <button
                            type="button"
                            className="link-btn link-btn--danger"
                            onClick={() => deleteExpenseMutation.mutate(e.id)}
                            disabled={deleteExpenseMutation.isPending}
                          >
                            {t('common.confirm')}
                          </button>
                          <button type="button" className="link-btn" onClick={() => setConfirmDeleteId(null)}>
                            {t('common.cancel')}
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="link-btn link-btn--danger" onClick={() => setConfirmDeleteId(e.id)}>
                          {t('common.delete')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {deleteError && <div className="form-error-banner">{deleteError}</div>}
        <div className="report-detail-totals">
          <div className="report-detail-totals__item">
            <span>{t('reports.expenses.title')}</span>
            <span>{formatMoney(data.reduce((s, e) => s + e.amountCents, 0))}</span>
          </div>
        </div>
      </>
    );
  } else if (detail.kind === 'netCash') {
    title = t('reports.detail.netCashTitle');
    const collected = financial?.totalCollectedCents ?? 0;
    const expensesTotal = financial?.totalExpensesCents ?? expensesQuery.data?.reduce((s, e) => s + e.amountCents, 0) ?? 0;
    const net = financial?.netCashCents ?? collected - expensesTotal;
    columns = [];
    printRows = [];
    totals = [
      { label: t('reports.financial.totalCollected'), value: formatMoney(collected) },
      { label: t('reports.financial.totalExpenses'), value: `- ${formatMoney(expensesTotal)}` },
      { label: t('reports.financial.netCash'), value: formatMoney(net) },
    ];
    bodyContent = (
      <>
        <p className="muted">{t('reports.financial.netCashHint')}</p>
        <div className="report-detail-totals">
          {totals.map((item) => (
            <div key={item.label} className="report-detail-totals__item">
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      </>
    );
  } else if (detail.kind === 'appointments') {
    title = detail.status
      ? `${t('reports.appointmentsSummary.title')} — ${t(`appointmentsPage.status.${detail.status}`)}`
      : t('reports.appointmentsSummary.total');
    columns = [
      t('common.date'),
      t('common.time'),
      t('appointmentsPage.duration'),
      t('receipt.patient'),
      t('appointmentsPage.reason'),
      t('common.status'),
    ];
    const data = appointmentsQuery.data ?? [];
    rows = data.map((a) => [
      formatDateDisplay(a.date, language),
      a.time,
      t('appointmentsPage.durationMinutes', { count: a.durationMin }),
      a.patientName,
      a.reason || t(`appointmentsPage.appointmentTypes.${a.appointmentType}`),
      t(`appointmentsPage.status.${a.status}`),
    ]);
    printRows = rows;
  } else if (detail.kind === 'patients') {
    title = t(detail.onlyNew ? 'reports.patientsSummary.newPatients' : 'reports.patientsSummary.totalPatients');
    columns = [t('receipt.fileNumber'), t('receipt.patient'), t('patientRecord.patient.phone'), t('reports.detail.registrationDate')];
    const data = patientsQuery.data ?? [];
    rows = data.map((p) => [p.fileNumber, p.fullName, p.phone, formatDateDisplay(p.createdAt.slice(0, 10), language)]);
    printRows = rows;
  }

  async function handlePrint() {
    const clinic = await loadClinicPrintInfo();
    print(
      <ReportPrintable
        title={title}
        periodLabel={periodLabel}
        clinic={clinic}
        language={language}
        columns={columns}
        rows={printRows}
        totals={totals}
      />,
    );
  }

  const isLoading =
    treatmentsQuery.isLoading ||
    paymentsQuery.isLoading ||
    outstandingQuery.isLoading ||
    debtsQuery.isLoading ||
    expensesQuery.isLoading ||
    appointmentsQuery.isLoading ||
    patientsQuery.isLoading;

  return (
    <Modal
      title={title}
      icon={<BarChart3 size={16} />}
      onClose={onClose}
      size="wide"
      headerExtra={
        <button type="button" className="icon-btn report-detail-header__print" title={t('reports.print.action') ?? ''} onClick={handlePrint}>
          <Printer size={14} />
        </button>
      }
    >
      {bodyContent ? (
        bodyContent
      ) : isLoading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="muted">{t('reports.print.noData')}</p>
      ) : (
        <>
          <table className="payment-history-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {totals && totals.length > 0 && (
            <div className="report-detail-totals">
              {totals.map((item) => (
                <div key={item.label} className="report-detail-totals__item">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
