import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Printer, ScrollText } from 'lucide-react';
import { ReportPrintable } from '@/components/reports/ReportPrintable';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { useUiStore } from '@/store/ui.store';
import { reportsApi } from '@/api/reports.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { localMonthStartIso, todayIso } from '@/utils/date';
import { DateField } from '@/components/common/DateField';
import { formatMoney } from '@/utils/money';
import { ReportDetailModal, ReportDetailSpec } from '@/components/reports/ReportDetailModal';
import { SimpleMoneyChart } from '@/components/reports/SimpleMoneyChart';
import { AppointmentStatus } from '@/types/domain';

type PeriodOption = 'today' | 'month' | 'custom';

function monthStartIso(): string {
  return localMonthStartIso();
}

const APPOINTMENT_STATUS_KEYS: { key: 'scheduled' | 'waiting' | 'inTreatment' | 'completed' | 'cancelled'; statusCode: AppointmentStatus }[] = [
  { key: 'scheduled', statusCode: 'SCHEDULED' },
  { key: 'waiting', statusCode: 'WAITING' },
  { key: 'inTreatment', statusCode: 'IN_TREATMENT' },
  { key: 'completed', statusCode: 'COMPLETED' },
  { key: 'cancelled', statusCode: 'CANCELLED' },
];

export function ReportsPage() {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const print = usePrintStore((s) => s.print);
  const canViewFinancial = usePermission(PERMISSIONS.REPORTS_FINANCIAL_VIEW);
  const [period, setPeriod] = useState<PeriodOption>('today');
  const [customFrom, setCustomFrom] = useState(todayIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [detail, setDetail] = useState<ReportDetailSpec | null>(null);

  const { from, to } = useMemo(() => {
    if (period === 'today') return { from: todayIso(), to: todayIso() };
    if (period === 'month') return { from: monthStartIso(), to: todayIso() };
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo]);

  const periodLabel = period === 'custom' ? `${customFrom} — ${customTo}` : from === to ? from : `${from} — ${to}`;

  const { data: summary } = useQuery({
    queryKey: ['reports-summary', from, to],
    queryFn: () => reportsApi.summary(from, to),
  });

  const financial = summary?.financial;

  async function handlePrintSummary() {
    if (!financial) return;
    const clinic = await loadClinicPrintInfo();
    print(
      <ReportPrintable
        title={t('reports.title')}
        periodLabel={periodLabel}
        clinic={clinic}
        language={language}
        columns={[t('reports.print.metric'), t('reports.print.value')]}
        rows={[
          [t('reports.financial.netCash'), formatMoney(financial.netCashCents ?? 0)],
          [t('reports.financial.totalCollected'), formatMoney(financial.totalCollectedCents ?? 0)],
          [t('reports.financial.outstandingBalance'), formatMoney(financial.outstandingBalanceCents ?? 0)],
          [t('reports.financial.totalExpenses'), formatMoney(financial.totalExpensesCents ?? 0)],
          [t('reports.financial.totalTreatmentValue'), formatMoney(financial.totalTreatmentValueCents ?? 0)],
          [t('reports.financial.totalDiscounts'), formatMoney(financial.totalDiscountCents ?? 0)],
        ]}
        orientation="portrait"
      />,
    );
  }

  return (
    <div className="ops-shell reports-page">
      <header className="ops-page-head">
        <div className="ops-page-head-copy">
          <h1>{t('reports.title')}</h1>
          <p>{t('reports.pageHint')}</p>
        </div>
        <div className="ops-page-head-actions">
          {canViewFinancial && (
            <button type="button" className="btn btn--ghost" onClick={() => void handlePrintSummary()} disabled={!financial}>
              <Printer size={14} /> {t('common.print')}
            </button>
          )}
          <Link to="/daily-report" className="page-feature-link page-feature-link--report">
            <span className="page-feature-link__icon" aria-hidden="true">
              <ScrollText size={16} />
            </span>
            {t('nav.dailyReport')}
          </Link>
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
      </div>

      {canViewFinancial && (
        <>
          <div className="ops-report-lead">
            <button type="button" className="ops-kpi is-hero clickable" onClick={() => setDetail({ kind: 'netCash' })}>
              <span className="ops-kpi-label">{t('reports.financial.netCash')}</span>
              <span className="ops-kpi-value">{formatMoney(financial?.netCashCents ?? 0)}</span>
              <span className="ops-kpi-hint">{t('reports.financial.netCashHint')}</span>
            </button>
            <div className="ops-kpis ops-kpis-tight">
              <button type="button" className="ops-kpi is-ok clickable" onClick={() => setDetail({ kind: 'payments' })}>
                <span className="ops-kpi-label">{t('reports.financial.totalCollected')}</span>
                <span className="ops-kpi-value">{formatMoney(financial?.totalCollectedCents ?? 0)}</span>
              </button>
              <button type="button" className="ops-kpi is-overdue clickable" onClick={() => setDetail({ kind: 'outstanding' })}>
                <span className="ops-kpi-label">{t('reports.financial.outstandingBalance')}</span>
                <span className="ops-kpi-value">{formatMoney(financial?.outstandingBalanceCents ?? 0)}</span>
              </button>
              <button type="button" className="ops-kpi clickable" onClick={() => setDetail({ kind: 'expenses' })}>
                <span className="ops-kpi-label">{t('reports.financial.totalExpenses')}</span>
                <span className="ops-kpi-value">{formatMoney(financial?.totalExpensesCents ?? 0)}</span>
              </button>
            </div>
          </div>

          <div className="ops-kpis">
            <button type="button" className="ops-kpi clickable" onClick={() => setDetail({ kind: 'treatments', onlyDiscounted: false })}>
              <span className="ops-kpi-label">{t('reports.financial.totalTreatmentValue')}</span>
              <span className="ops-kpi-value">{formatMoney(financial?.totalTreatmentValueCents ?? 0)}</span>
            </button>
            <button type="button" className="ops-kpi clickable" onClick={() => setDetail({ kind: 'treatments', onlyDiscounted: true })}>
              <span className="ops-kpi-label">{t('reports.financial.totalDiscounts')}</span>
              <span className="ops-kpi-value">{formatMoney(financial?.totalDiscountCents ?? 0)}</span>
            </button>
          </div>
          <p className="ops-meta ops-hint">{t('reports.financial.outstandingBalanceHint')}</p>

          <div className="ops-chart">
            <SimpleMoneyChart
              title={t('reports.chart.title')}
              bars={[
                { label: t('reports.financial.totalCollected'), valueCents: financial?.totalCollectedCents ?? 0 },
                { label: t('reports.financial.outstandingBalance'), valueCents: financial?.outstandingBalanceCents ?? 0 },
                { label: t('reports.financial.totalExpenses'), valueCents: financial?.totalExpensesCents ?? 0 },
                { label: t('reports.financial.netCash'), valueCents: financial?.netCashCents ?? 0 },
              ]}
            />
          </div>
        </>
      )}

      <h2 className="ops-section-title">{t('reports.appointmentsSummary.title')}</h2>
      <div className="ops-kpis">
        <button type="button" className="ops-kpi is-hero clickable" onClick={() => setDetail({ kind: 'appointments' })}>
          <span className="ops-kpi-label">{t('reports.appointmentsSummary.total')}</span>
          <span className="ops-kpi-value">{summary?.appointments.total ?? 0}</span>
        </button>
        {APPOINTMENT_STATUS_KEYS.map(({ key, statusCode }) => (
          <button
            key={key}
            type="button"
            className="ops-kpi clickable"
            onClick={() => setDetail({ kind: 'appointments', status: statusCode })}
          >
            <span className="ops-kpi-label">{t(`appointmentsPage.status.${statusCode}`)}</span>
            <span className="ops-kpi-value">{summary?.appointments[key] ?? 0}</span>
          </button>
        ))}
      </div>

      <h2 className="ops-section-title">{t('reports.patientsSummary.title')}</h2>
      <div className="ops-kpis">
        <button type="button" className="ops-kpi clickable" onClick={() => setDetail({ kind: 'patients', onlyNew: false })}>
          <span className="ops-kpi-label">{t('reports.patientsSummary.totalPatients')}</span>
          <span className="ops-kpi-value">{summary?.patients.totalPatients ?? 0}</span>
        </button>
        <button type="button" className="ops-kpi is-ok clickable" onClick={() => setDetail({ kind: 'patients', onlyNew: true })}>
          <span className="ops-kpi-label">{t('reports.patientsSummary.newPatients')}</span>
          <span className="ops-kpi-value">{summary?.patients.newPatients ?? 0}</span>
        </button>
      </div>

      {detail && (
        <ReportDetailModal
          detail={detail}
          from={from}
          to={to}
          periodLabel={periodLabel}
          financial={summary?.financial}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
