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
import { formatMoney } from '@/utils/money';
import { formatDateDisplay, todayIso } from '@/utils/date';
import { ClinicPrintInfo } from '@/utils/clinicPrintInfo';
import type { ClinicExpense } from '@/types/domain';

type PrintableExpense = ClinicExpense & { categoryLabel?: string; paymentMethod?: string };

export function ExpensesPrintable({
  expenses,
  periodLabel,
  categoryTotals,
  clinic,
  language,
}: {
  expenses: PrintableExpense[];
  periodLabel: string;
  categoryTotals: Array<{ label: string; totalCents: number }>;
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();
  const grandTotal = expenses.reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <PrintDocument orientation="portrait">
      <PrintReportHeader
        clinic={clinic}
        title={t('reports.expenses.title')}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('reports.print.period')} value={periodLabel} />
            <PrintMetaItem label={t('statement.printDate')} value={formatDateDisplay(todayIso(), language)} />
          </PrintMetaRow>
        }
      />

      {categoryTotals.length > 0 && (
        <PrintSection title={t('reports.expenses.byCategory')}>
          <PrintTotals
            rows={categoryTotals.map((c) => ({
              label: c.label,
              value: formatMoney(c.totalCents),
            }))}
          />
        </PrintSection>
      )}

      <PrintSection title={t('reports.expenses.title')}>
        <PrintTable compact>
          <thead>
            <tr>
              <th>{t('common.date')}</th>
              <th>{t('reports.expenses.category')}</th>
              <th>{t('reports.expenses.paidTo')}</th>
              <th>{t('patientRecord.account.method')}</th>
              <th>{t('patientRecord.account.amount')}</th>
              <th>{t('common.note')}</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{formatDateDisplay(e.date, language)}</td>
                <td>{String(e.categoryLabel ?? e.category)}</td>
                <td>{e.paidTo ?? '—'}</td>
                <td>{e.paymentMethod ?? '—'}</td>
                <td>{formatMoney(e.amountCents)}</td>
                <td>{e.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </PrintTable>
      </PrintSection>

      <PrintTotals rows={[{ label: t('reports.expenses.total'), value: formatMoney(grandTotal), kind: 'emphasis' }]} />
      <PrintFooter note={t('receipt.issuedByClinic')} />
    </PrintDocument>
  );
}
