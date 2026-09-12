import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, MessageCircle, Printer, ScrollText } from 'lucide-react';
import { reportsApi } from '@/api/reports.api';
import { settingsApi } from '@/api/settings.api';
import { DailyReportPrintable } from '@/components/daily-report/DailyReportPrintable';
import { usePrintStore } from '@/store/print.store';
import { useUiStore } from '@/store/ui.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { formatDateDisplay, formatDateTimeDisplay, localTodayIso } from '@/utils/date';
import { DateField } from '@/components/common/DateField';
import { formatMoney } from '@/utils/money';
import { openWhatsApp } from '@/utils/whatsapp';

export function DailyReportPage() {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const print = usePrintStore((s) => s.print);
  const [selectedDate, setSelectedDate] = useState(localTodayIso());
  const isToday = selectedDate === localTodayIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ['daily-report', selectedDate],
    queryFn: () => reportsApi.daily(selectedDate),
  });

  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => settingsApi.getClinic(),
  });

  async function handlePrint() {
    if (!report) return;
    const clinic = await loadClinicPrintInfo();
    print(<DailyReportPrintable report={report} clinic={clinic} language={language} />);
  }

  function handleWhatsApp() {
    if (!report) return;
    const doctorPhone = clinicSettings?.doctorPhone;
    if (!doctorPhone) return;

    const clinicName = clinicSettings?.clinicName || t('app.name');
    const lines: string[] = [
      t('dailyReport.whatsapp.header', { date: formatDateDisplay(report.date, language) }),
      report.generatedAt
        ? t('dailyReport.createdAt', { datetime: formatDateTimeDisplay(report.generatedAt, language) })
        : '',
      '',
      t('dailyReport.sections.newPatients'),
      report.newPatients.length
        ? report.newPatients.map((p) => `- ${p.fullName} (${p.fileNumber})`).join('\n')
        : t('dailyReport.noNewPatients'),
      '',
      t('dailyReport.sections.payments'),
      report.payments.length
        ? report.payments
            .map((p) => `- ${p.patientName}: ${formatMoney(p.amountCents)} (${p.methodLabel ?? p.method})`)
            .join('\n')
        : t('dailyReport.noPayments'),
      t('dailyReport.totalPayments') + `: ${formatMoney(report.summary.paymentsTotalCents)}`,
      '',
      t('dailyReport.sections.followUps'),
      report.followUps.length
        ? report.followUps
            .map((fu) => {
              const result = fu.result ? t(`followUp.results.${fu.result}`) : '—';
              return `- ${fu.patientName} (${t(`followUp.types.${fu.type}`)}) — ${fu.reason} — ${result}`;
            })
            .join('\n')
        : t('dailyReport.noFollowUps'),
      '',
      t('dailyReport.sections.todayAppointments'),
      report.todayAppointments.length
        ? report.todayAppointments
            .map(
              (a) =>
                `- ${a.time} ${a.patientName}${a.reason ? ` — ${a.reason}` : ''} (${t(`appointmentsPage.status.${a.status}`)})`,
            )
            .join('\n')
        : t('dailyReport.noTodayAppointments'),
      '',
      t('dailyReport.sections.tomorrowAppointments'),
      report.tomorrowAppointments.length
        ? report.tomorrowAppointments
            .map((a) => `- ${a.time} ${a.patientName}${a.reason ? ` — ${a.reason}` : ''}`)
            .join('\n')
        : t('dailyReport.noTomorrowAppointments'),
    ];

    openWhatsApp(doctorPhone, lines.join('\n'));
  }

  if (isLoading || !report) {
    return <p className="muted">{t('common.loading')}</p>;
  }

  return (
    <div className="daily-report-page">
      <div className="daily-report-page__header">
        <h1>
          <ScrollText size={22} />
          {t('dailyReport.title')}
        </h1>
        <div className="daily-report-page__actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={handlePrint}>
            <Printer size={14} /> {t('dailyReport.print')}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small btn--whatsapp"
            onClick={handleWhatsApp}
            disabled={!clinicSettings?.doctorPhone}
            title={!clinicSettings?.doctorPhone ? t('whatsapp.noDoctorPhone') ?? '' : ''}
          >
            <MessageCircle size={14} /> {t('dailyReport.sendWhatsApp')}
          </button>
        </div>
      </div>

      <div className="follow-up-date-bar">
        <label className="follow-up-date-bar__label" htmlFor="daily-report-selected-date">
          {t('dailyReport.selectDate')}
        </label>
        <DateField
          id="daily-report-selected-date"
          className="follow-up-date-bar__input"
          value={selectedDate}
          onChange={setSelectedDate}
        />
        {!isToday && (
          <button
            type="button"
            className="link-btn follow-up-date-bar__today"
            onClick={() => setSelectedDate(localTodayIso())}
          >
            {t('dailyReport.backToToday')}
          </button>
        )}
      </div>

      <p className="muted daily-report-page__date">
        {formatDateDisplay(report.date, language)}
        {report.generatedAt && (
          <>
            {' · '}
            {t('dailyReport.createdAt', {
              datetime: formatDateTimeDisplay(report.generatedAt, language),
            })}
          </>
        )}
      </p>

      <div className="daily-report-summary">
        <div className="daily-report-summary__card">
          <span className="daily-report-summary__value">{report.summary.newPatientsCount}</span>
          <span className="daily-report-summary__label">{t('dailyReport.summary.newPatients')}</span>
        </div>
        <div className="daily-report-summary__card">
          <span className="daily-report-summary__value">{formatMoney(report.summary.paymentsTotalCents)}</span>
          <span className="daily-report-summary__label">{t('dailyReport.summary.payments')}</span>
        </div>
        <div className="daily-report-summary__card">
          <span className="daily-report-summary__value">{report.summary.followUpsDueToday}</span>
          <span className="daily-report-summary__label">
            {isToday
              ? t('dailyReport.summary.followUpsDueToday')
              : t('dailyReport.summary.followUpsDueOnDate', { date: formatDateDisplay(report.date, language) })}
          </span>
        </div>
        <div className="daily-report-summary__card daily-report-summary__card--warn">
          <span className="daily-report-summary__value">{report.summary.followUpsOverdue}</span>
          <span className="daily-report-summary__label">{t('dailyReport.summary.followUpsOverdue')}</span>
        </div>
        <div className="daily-report-summary__card">
          <span className="daily-report-summary__value">{report.summary.labCasesDueToday ?? 0}</span>
          <span className="daily-report-summary__label">{t('dailyReport.summary.labCasesDueToday')}</span>
        </div>
        <div className="daily-report-summary__card daily-report-summary__card--warn">
          <span className="daily-report-summary__value">{report.summary.labCasesOverdue ?? 0}</span>
          <span className="daily-report-summary__label">{t('dailyReport.summary.labCasesOverdue')}</span>
        </div>
        <div className="daily-report-summary__card">
          <span className="daily-report-summary__value">{report.summary.tomorrowAppointmentsCount}</span>
          <span className="daily-report-summary__label">{t('dailyReport.summary.tomorrowAppointments')}</span>
        </div>
      </div>

      <section className="daily-report-section">
        <h2>{t('dailyReport.sections.newPatients')} ({report.newPatients.length})</h2>
        {report.newPatients.length === 0 ? (
          <p className="muted">{t('dailyReport.noNewPatients')}</p>
        ) : (
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>{t('patients.fullName')}</th>
                <th>{t('patientRecord.patient.phone')}</th>
                <th>{t('patientRecord.patient.fileNumber')}</th>
                <th>{t('dailyReport.registrationTime')}</th>
              </tr>
            </thead>
            <tbody>
              {report.newPatients.map((p) => (
                <tr key={p.id}>
                  <td>{p.fullName}</td>
                  <td>{p.phone}</td>
                  <td>{p.fileNumber}</td>
                  <td>{formatDateTimeDisplay(p.createdAt, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="daily-report-section">
        <h2>{t('dailyReport.sections.payments')}</h2>
        {report.payments.length === 0 ? (
          <p className="muted">{t('dailyReport.noPayments')}</p>
        ) : (
          <>
            <table className="payment-history-table">
              <thead>
                <tr>
                  <th>{t('followUp.columns.patient')}</th>
                  <th>{t('patientRecord.account.amount')}</th>
                  <th>{t('patientRecord.account.method')}</th>
                  <th>{t('common.time')}</th>
                </tr>
              </thead>
              <tbody>
                {report.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.patientName}</td>
                    <td>{formatMoney(p.amountCents)}</td>
                    <td>{p.methodLabel ?? p.method}</td>
                    <td>{formatDateTimeDisplay(p.createdAt, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="daily-report-total">
              {t('dailyReport.totalPayments')}: <strong>{formatMoney(report.summary.paymentsTotalCents)}</strong>
            </p>
          </>
        )}
      </section>

      {report.cashReport && (
        <section className="daily-report-section">
          <h2>{t('dailyReport.sections.cashReport')}</h2>
          <div className="daily-report-cash-summary">
            <div className="daily-report-summary__card">
              <span className="daily-report-summary__value">{formatMoney(report.cashReport.cashInCents)}</span>
              <span className="daily-report-summary__label">{t('dailyReport.cash.cashIn')}</span>
            </div>
            <div className="daily-report-summary__card daily-report-summary__card--warn">
              <span className="daily-report-summary__value">{formatMoney(report.cashReport.cashOutCents)}</span>
              <span className="daily-report-summary__label">{t('dailyReport.cash.cashOut')}</span>
            </div>
            <div className="daily-report-summary__card">
              <span className="daily-report-summary__value">{formatMoney(report.cashReport.balanceCents)}</span>
              <span className="daily-report-summary__label">{t('dailyReport.cash.balance')}</span>
            </div>
          </div>
          {report.cashReport.movements.length === 0 ? (
            <p className="muted">{t('dailyReport.cash.noMovements')}</p>
          ) : (
            <table className="payment-history-table">
              <thead>
                <tr>
                  <th>{t('common.time')}</th>
                  <th>{t('dailyReport.cash.type')}</th>
                  <th>{t('dailyReport.cash.description')}</th>
                  <th>{t('dailyReport.cash.detail')}</th>
                  <th>{t('patientRecord.account.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {report.cashReport.movements.map((m, idx) => (
                  <tr key={`${m.kind}-${m.time}-${idx}`}>
                    <td>{formatDateTimeDisplay(m.time, language)}</td>
                    <td>{m.kind === 'IN' ? t('dailyReport.cash.cashIn') : t('dailyReport.cash.cashOut')}</td>
                    <td>{m.label}</td>
                    <td>{m.detail}</td>
                    <td className={m.kind === 'OUT' ? 'daily-report-cash-out' : undefined}>
                      {m.kind === 'OUT' ? '−' : '+'}
                      {formatMoney(m.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="daily-report-section">
        <h2>{t('dailyReport.sections.followUps')}</h2>
        <div className="daily-report-followup-totals muted">
          {t('dailyReport.followUpTotals', {
            total: report.summary.followUpsTotal,
            completed: report.summary.followUpsCompleted,
            dueToday: report.summary.followUpsDueToday,
            overdue: report.summary.followUpsOverdue,
          })}
        </div>
        {report.followUps.length === 0 ? (
          <p className="muted">{t('dailyReport.noFollowUps')}</p>
        ) : (
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>{t('followUp.columns.patient')}</th>
                <th>{t('followUp.columns.type')}</th>
                <th>{t('followUp.columns.reason')}</th>
                <th>{t('followUp.columns.result')}</th>
                <th>{t('followUp.columns.status')}</th>
                <th>{t('followUp.actions.nextDate')}</th>
              </tr>
            </thead>
            <tbody>
              {report.followUps.map((fu) => (
                <tr key={`${fu.status}-${fu.id}`}>
                  <td>{fu.patientName}</td>
                  <td>{t(`followUp.types.${fu.type}`)}</td>
                  <td>{fu.reason}</td>
                  <td>{fu.result ? t(`followUp.results.${fu.result}`) : '—'}</td>
                  <td>{t(`dailyReport.followUpStatus.${fu.status}`)}</td>
                  <td>{fu.nextFollowUpDate ? formatDateDisplay(fu.nextFollowUpDate, language) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(report.labCasesDue?.length ?? 0) > 0 && (
        <section className="daily-report-section">
          <h2>{t('dailyReport.sections.labCases')}</h2>
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>{t('labCases.patient')}</th>
                <th>{t('labCases.labName')}</th>
                <th>{t('labCases.workType')}</th>
                <th>{t('labCases.teeth')}</th>
                <th>{t('labCases.expectedDelivery')}</th>
                <th>{t('labCases.status')}</th>
              </tr>
            </thead>
            <tbody>
              {(report.labCasesDue ?? []).map((c) => (
                <tr key={c.id}>
                  <td>{c.patientName}</td>
                  <td>{c.labName}</td>
                  <td>{c.workTypeLabel}</td>
                  <td>{c.teeth.join(', ')}</td>
                  <td>{c.expectedDeliveryDate ? formatDateDisplay(c.expectedDeliveryDate, language) : '—'}</td>
                  <td>{t(`labCases.statuses.${c.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="daily-report-section">
        <h2>
          <CalendarClock size={16} /> {t('dailyReport.sections.todayAppointments')}
        </h2>
        {report.todayAppointments.length === 0 ? (
          <p className="muted">{t('dailyReport.noTodayAppointments')}</p>
        ) : (
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>{t('common.time')}</th>
                <th>{t('followUp.columns.patient')}</th>
                <th>{t('appointmentsPage.reason')}</th>
                <th>{t('appointmentsPage.duration')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {report.todayAppointments.map((a) => (
                <tr key={a.id}>
                  <td>{a.time}</td>
                  <td>{a.patientName}</td>
                  <td>{a.reason || '—'}</td>
                  <td>{t('appointmentsPage.durationMinutes', { count: a.durationMin })}</td>
                  <td>{t(`appointmentsPage.status.${a.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="daily-report-section">
        <h2>
          <CalendarClock size={16} /> {t('dailyReport.sections.tomorrowAppointments')}
        </h2>
        {report.tomorrowAppointments.length === 0 ? (
          <p className="muted">{t('dailyReport.noTomorrowAppointments')}</p>
        ) : (
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>{t('common.time')}</th>
                <th>{t('followUp.columns.patient')}</th>
                <th>{t('appointmentsPage.reason')}</th>
                <th>{t('appointmentsPage.duration')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {report.tomorrowAppointments.map((a) => (
                <tr key={a.id}>
                  <td>{a.time}</td>
                  <td>{a.patientName}</td>
                  <td>{a.reason || '—'}</td>
                  <td>{t('appointmentsPage.durationMinutes', { count: a.durationMin })}</td>
                  <td>{t(`appointmentsPage.status.${a.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
