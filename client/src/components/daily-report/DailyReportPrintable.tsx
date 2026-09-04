import { useTranslation } from 'react-i18next';
import {
  PrintDocument,
  PrintFooter,
  PrintMetaItem,
  PrintMetaRow,
  PrintReportHeader,
  PrintSection,
  PrintTable,
  PrintTotals,
} from '@/components/common/PrintLayout';
import { DailyReport } from '@/types/domain';
import { ClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { formatDateDisplay, formatDateTimeDisplay } from '@/utils/date';
import { formatMoney } from '@/utils/money';

export function DailyReportPrintable({
  report,
  clinic,
  language,
}: {
  report: DailyReport;
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();

  return (
    <PrintDocument orientation="landscape">
      <PrintReportHeader
        clinic={clinic}
        title={t('dailyReport.title')}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('common.date')} value={formatDateDisplay(report.date, language)} />
            {report.generatedAt && (
              <PrintMetaItem
                label={t('dailyReport.createdLabel')}
                value={formatDateTimeDisplay(report.generatedAt, language)}
              />
            )}
          </PrintMetaRow>
        }
      />

      <PrintSection title={t('dailyReport.sections.newPatients')}>
        <PrintTable compact>
          <thead>
            <tr>
              <th>{t('patients.fullName')}</th>
              <th>{t('patientRecord.patient.phone')}</th>
              <th>{t('patientRecord.patient.fileNumber')}</th>
              <th>{t('common.time')}</th>
            </tr>
          </thead>
          <tbody>
            {report.newPatients.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  {t('dailyReport.noNewPatients')}
                </td>
              </tr>
            ) : (
              report.newPatients.map((p) => (
                <tr key={p.id}>
                  <td>{p.fullName}</td>
                  <td>{p.phone}</td>
                  <td>{p.fileNumber}</td>
                  <td>{formatDateTimeDisplay(p.createdAt, language)}</td>
                </tr>
              ))
            )}
          </tbody>
        </PrintTable>
      </PrintSection>

      <PrintSection title={t('dailyReport.sections.payments')}>
        <PrintTable compact>
          <thead>
            <tr>
              <th>{t('followUp.columns.patient')}</th>
              <th>{t('patientRecord.account.amount')}</th>
              <th>{t('patientRecord.account.method')}</th>
              <th>{t('common.time')}</th>
            </tr>
          </thead>
          <tbody>
            {report.payments.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  {t('dailyReport.noPayments')}
                </td>
              </tr>
            ) : (
              report.payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.patientName}</td>
                  <td>{formatMoney(p.amountCents)}</td>
                  <td>{p.methodLabel ?? p.method}</td>
                  <td>{formatDateTimeDisplay(p.createdAt, language)}</td>
                </tr>
              ))
            )}
          </tbody>
        </PrintTable>
        <PrintTotals
          rows={[
            {
              label: t('dailyReport.totalPayments'),
              value: formatMoney(report.summary.paymentsTotalCents),
              kind: 'emphasis',
            },
          ]}
        />
      </PrintSection>

      {report.cashReport && (
        <PrintSection title={t('dailyReport.sections.cashReport')}>
          <PrintTotals
            rows={[
              { label: t('dailyReport.cash.cashIn'), value: formatMoney(report.cashReport.cashInCents) },
              { label: t('dailyReport.cash.cashOut'), value: formatMoney(report.cashReport.cashOutCents) },
              {
                label: t('dailyReport.cash.balance'),
                value: formatMoney(report.cashReport.balanceCents),
                kind: 'emphasis',
              },
            ]}
          />
          <PrintTable compact>
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
              {report.cashReport.movements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    {t('dailyReport.cash.noMovements')}
                  </td>
                </tr>
              ) : (
                report.cashReport.movements.map((m, idx) => (
                  <tr key={`${m.kind}-${m.time}-${idx}`}>
                    <td>{formatDateTimeDisplay(m.time, language)}</td>
                    <td>{m.kind === 'IN' ? t('dailyReport.cash.cashIn') : t('dailyReport.cash.cashOut')}</td>
                    <td>{m.label}</td>
                    <td>{m.detail}</td>
                    <td>
                      {m.kind === 'OUT' ? '−' : '+'}
                      {formatMoney(m.amountCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </PrintTable>
        </PrintSection>
      )}

      <PrintSection title={t('dailyReport.sections.followUps')}>
        <PrintTable compact>
          <thead>
            <tr>
              <th>{t('followUp.columns.patient')}</th>
              <th>{t('followUp.columns.type')}</th>
              <th>{t('followUp.columns.reason')}</th>
              <th>{t('followUp.columns.result')}</th>
              <th>{t('followUp.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {report.followUps.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {t('dailyReport.noFollowUps')}
                </td>
              </tr>
            ) : (
              report.followUps.map((fu) => (
                <tr key={`${fu.status}-${fu.id}`}>
                  <td>{fu.patientName}</td>
                  <td>{t(`followUp.types.${fu.type}`)}</td>
                  <td>{fu.reason}</td>
                  <td>{fu.result ? t(`followUp.results.${fu.result}`) : '—'}</td>
                  <td>{t(`dailyReport.followUpStatus.${fu.status}`)}</td>
                </tr>
              ))
            )}
          </tbody>
        </PrintTable>
      </PrintSection>

      <PrintSection title={t('dailyReport.sections.todayAppointments')}>
        <PrintTable compact>
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
            {report.todayAppointments.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {t('dailyReport.noTodayAppointments')}
                </td>
              </tr>
            ) : (
              report.todayAppointments.map((a) => (
                <tr key={a.id}>
                  <td>{a.time}</td>
                  <td>{a.patientName}</td>
                  <td>{a.reason || '—'}</td>
                  <td>{t('appointmentsPage.durationMinutes', { count: a.durationMin })}</td>
                  <td>{t(`appointmentsPage.status.${a.status}`)}</td>
                </tr>
              ))
            )}
          </tbody>
        </PrintTable>
      </PrintSection>

      <PrintSection title={t('dailyReport.sections.tomorrowAppointments')}>
        <PrintTable compact>
          <thead>
            <tr>
              <th>{t('common.time')}</th>
              <th>{t('followUp.columns.patient')}</th>
              <th>{t('appointmentsPage.reason')}</th>
              <th>{t('appointmentsPage.duration')}</th>
            </tr>
          </thead>
          <tbody>
            {report.tomorrowAppointments.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  {t('dailyReport.noTomorrowAppointments')}
                </td>
              </tr>
            ) : (
              report.tomorrowAppointments.map((a) => (
                <tr key={a.id}>
                  <td>{a.time}</td>
                  <td>{a.patientName}</td>
                  <td>{a.reason || '—'}</td>
                  <td>{t('appointmentsPage.durationMinutes', { count: a.durationMin })}</td>
                </tr>
              ))
            )}
          </tbody>
        </PrintTable>
      </PrintSection>

      <PrintFooter />
    </PrintDocument>
  );
}
