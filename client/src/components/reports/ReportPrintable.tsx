import { useTranslation } from 'react-i18next';
import {
  PrintDocument,
  PrintFooter,
  PrintMetaItem,
  PrintMetaRow,
  PrintReportHeader,
  PrintTable,
  PrintTotals,
} from '@/components/common/PrintLayout';
import { ClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { formatDateDisplay, todayIso } from '@/utils/date';

/** Generic A5 print layout reused by every Reports drill-down ("Print" action). */
export function ReportPrintable({
  title,
  periodLabel,
  clinic,
  language,
  columns,
  rows,
  totals,
  orientation = 'landscape',
}: {
  title: string;
  periodLabel: string;
  clinic: ClinicPrintInfo;
  language: string;
  columns: string[];
  rows: (string | number)[][];
  totals?: { label: string; value: string }[];
  orientation?: 'portrait' | 'landscape';
}) {
  const { t } = useTranslation();
  const resolvedOrientation = orientation ?? (columns.length >= 5 ? 'landscape' : 'portrait');

  return (
    <PrintDocument orientation={resolvedOrientation}>
      <PrintReportHeader
        clinic={clinic}
        title={title}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('reports.print.period')} value={periodLabel} />
            <PrintMetaItem label={t('reports.print.printedOn')} value={formatDateDisplay(todayIso(), language)} />
          </PrintMetaRow>
        }
      />
      {columns.length > 0 && (
      <PrintTable compact={columns.length >= 6}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="muted">
                {t('reports.print.noData')}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </PrintTable>
      )}
      {totals && totals.length > 0 && (
        <PrintTotals
          rows={totals.map((item, index) => ({
            label: item.label,
            value: item.value,
            kind: index === totals.length - 1 ? ('emphasis' as const) : ('default' as const),
          }))}
        />
      )}
      <PrintFooter />
    </PrintDocument>
  );
}
