import { useTranslation } from 'react-i18next';
import {
  PrintDocument,
  PrintFooter,
  PrintMetaItem,
  PrintMetaRow,
  PrintReportHeader,
  PrintTable,
} from '@/components/common/PrintLayout';
import { FollowUpHistoryEntry, FollowUpWithPatient } from '@/types/domain';
import { ClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { formatDateDisplay, todayIso } from '@/utils/date';
import { formatMoney } from '@/utils/money';

export function FollowUpPrintable({
  clinic,
  language,
  items,
  historyByFollowUpId,
  reportDate,
}: {
  clinic: ClinicPrintInfo;
  language: string;
  items: FollowUpWithPatient[];
  historyByFollowUpId: Map<number, FollowUpHistoryEntry>;
  reportDate: string;
}) {
  const { t } = useTranslation();
  const title =
    reportDate === todayIso()
      ? t('followUp.print.title')
      : t('followUp.print.titleForDate', { date: formatDateDisplay(reportDate, language) });

  return (
    <PrintDocument orientation="landscape">
      <PrintReportHeader
        clinic={clinic}
        title={title}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('common.date')} value={formatDateDisplay(reportDate, language)} />
          </PrintMetaRow>
        }
      />
      <PrintTable compact>
        <thead>
          <tr>
            <th>{t('followUp.columns.patient')}</th>
            <th>{t('followUp.columns.type')}</th>
            <th>{t('followUp.columns.reason')}</th>
            <th>{t('followUp.columns.result')}</th>
            <th>{t('common.note')}</th>
            <th>{t('followUp.actions.nextDate')}</th>
            <th>{t('followUp.columns.status')}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} className="muted">
                {t('followUp.empty')}
              </td>
            </tr>
          ) : (
            items.map((fu) => {
              const hist = historyByFollowUpId.get(fu.id);
              return (
                <tr key={fu.id}>
                  <td>{fu.patientName}</td>
                  <td>{t(`followUp.types.${fu.type}`)}</td>
                  <td>{fu.reason}</td>
                  <td>{hist?.result ? t(`followUp.results.${hist.result}`) : '—'}</td>
                  <td>
                    {[hist?.note, hist?.appointmentSummary, hist?.paymentAmountCents != null ? formatMoney(hist.paymentAmountCents) : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td>{hist?.nextFollowUpDate ? formatDateDisplay(hist.nextFollowUpDate, language) : '—'}</td>
                  <td>{t(`followUp.statuses.${fu.displayStatus}`)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </PrintTable>
      <PrintFooter />
    </PrintDocument>
  );
}
