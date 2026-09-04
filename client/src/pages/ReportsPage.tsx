import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, ScrollText, Users2, Wallet } from 'lucide-react';
import { reportsApi } from '@/api/reports.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { todayIso } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { ReportDetailModal, ReportDetailSpec } from '@/components/reports/ReportDetailModal';
import { AppointmentStatus } from '@/types/domain';

type PeriodOption = 'today' | 'month' | 'custom';

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
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

  return (
    <div className="reports-page">
      <div className="reports-page__header">
        <div className="reports-page__title-row">
          <h1>{t('reports.title')}</h1>
          <Link to="/daily-report" className="page-feature-link page-feature-link--report">
            <span className="page-feature-link__icon" aria-hidden="true">
              <ScrollText size={16} />
            </span>
            {t('nav.dailyReport')}
          </Link>
        </div>
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
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="muted">—</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </span>
          )}
        </div>
      </div>

      {canViewFinancial && (
        <section className="settings-section">
          <h2>
            <Wallet size={16} className="reports-section-icon" /> {t('reports.financial.title')}
          </h2>
          <div className="report-cards">
            <ReportCard
              label={t('reports.financial.totalTreatmentValue')}
              value={formatMoney(summary?.financial.totalTreatmentValueCents ?? 0)}
              onClick={() => setDetail({ kind: 'treatments', onlyDiscounted: false })}
            />
            <ReportCard
              label={t('reports.financial.totalDiscounts')}
              value={formatMoney(summary?.financial.totalDiscountCents ?? 0)}
              onClick={() => setDetail({ kind: 'treatments', onlyDiscounted: true })}
            />
            <ReportCard
              label={t('reports.financial.totalCollected')}
              value={formatMoney(summary?.financial.totalCollectedCents ?? 0)}
              onClick={() => setDetail({ kind: 'payments' })}
            />
            <ReportCard
              label={t('reports.financial.outstandingBalance')}
              value={formatMoney(summary?.financial.outstandingBalanceCents ?? 0)}
              emphasize
              onClick={() => setDetail({ kind: 'outstanding' })}
            />
            <ReportCard
              label={t('reports.financial.totalExpenses')}
              value={formatMoney(summary?.financial.totalExpensesCents ?? 0)}
              onClick={() => setDetail({ kind: 'expenses' })}
            />
            <ReportCard
              label={t('reports.financial.netCash')}
              value={formatMoney(summary?.financial.netCashCents ?? 0)}
              emphasize
              onClick={() => setDetail({ kind: 'netCash' })}
            />
          </div>
          <p className="muted reports-financial-hint">{t('reports.financial.outstandingBalanceHint')}</p>
        </section>
      )}

      <section className="settings-section">
        <h2>
          <CalendarCheck size={16} className="reports-section-icon" /> {t('reports.appointmentsSummary.title')}
        </h2>
        <div className="report-cards">
          <ReportCard
            label={t('reports.appointmentsSummary.total')}
            value={String(summary?.appointments.total ?? 0)}
            emphasize
            onClick={() => setDetail({ kind: 'appointments' })}
          />
          {APPOINTMENT_STATUS_KEYS.map(({ key, statusCode }) => (
            <ReportCard
              key={key}
              label={t(`appointmentsPage.status.${statusCode}`)}
              value={String(summary?.appointments[key] ?? 0)}
              onClick={() => setDetail({ kind: 'appointments', status: statusCode })}
            />
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>
          <Users2 size={16} className="reports-section-icon" /> {t('reports.patientsSummary.title')}
        </h2>
        <div className="report-cards">
          <ReportCard
            label={t('reports.patientsSummary.totalPatients')}
            value={String(summary?.patients.totalPatients ?? 0)}
            onClick={() => setDetail({ kind: 'patients', onlyNew: false })}
          />
          <ReportCard
            label={t('reports.patientsSummary.newPatients')}
            value={String(summary?.patients.newPatients ?? 0)}
            emphasize
            onClick={() => setDetail({ kind: 'patients', onlyNew: true })}
          />
        </div>
      </section>

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

function ReportCard({
  label,
  value,
  emphasize,
  onClick,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        'report-card',
        emphasize ? 'report-card--emphasize' : '',
        onClick ? 'report-card--clickable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      <span className="report-card__value">{value}</span>
      <span className="report-card__label">{label}</span>
    </button>
  );
}
