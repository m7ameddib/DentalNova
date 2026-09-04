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
import type {
  LabAccountPaymentRow,
  LabAccountSummary,
  LabCaseWithDetails,
  LabStatementLine,
} from '@/types/domain';

export function LabStatementPrintable({
  labName,
  summary,
  orders,
  payments,
  statement,
  clinic,
  language,
}: {
  labName: string;
  summary: LabAccountSummary;
  orders: LabCaseWithDetails[];
  payments: LabAccountPaymentRow[];
  statement: LabStatementLine[];
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();

  return (
    <PrintDocument orientation="portrait">
      <PrintReportHeader
        clinic={clinic}
        title={t('labCases.accounts.statement')}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('labCases.labName')} value={labName} />
            <PrintMetaItem label={t('statement.printDate')} value={formatDateDisplay(todayIso(), language)} />
          </PrintMetaRow>
        }
      />

      <PrintTotals
        rows={[
          { label: t('labCases.accounts.total'), value: formatMoney(summary.totalCents) },
          { label: t('labCases.accounts.paid'), value: formatMoney(summary.paidCents) },
          {
            label: t('labCases.accounts.remaining'),
            value: formatMoney(summary.remainingCents),
            kind: 'balance',
          },
        ]}
      />

      <PrintSection title={t('labCases.accounts.orders')}>
        {orders.length === 0 ? (
          <p className="muted">{t('labCases.accounts.noOrders')}</p>
        ) : (
          <PrintTable compact>
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('labCases.accounts.patient')}</th>
                <th>{t('labCases.accounts.workType')}</th>
                <th>{t('labCases.accounts.cost')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{formatDateDisplay(o.sentDate ?? o.createdAt.slice(0, 10), language)}</td>
                  <td>{o.patientName}</td>
                  <td>{o.workTypeLabel}</td>
                  <td>{formatMoney(o.labCostCents)}</td>
                </tr>
              ))}
            </tbody>
          </PrintTable>
        )}
      </PrintSection>

      <PrintSection title={t('labCases.accounts.payments')}>
        {payments.length === 0 ? (
          <p className="muted">{t('labCases.accounts.noPayments')}</p>
        ) : (
          <PrintTable compact>
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('patientRecord.account.amount')}</th>
                <th>{t('patientRecord.account.method')}</th>
                <th>{t('common.note')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={`${p.source}-${p.id}`}>
                  <td>{p.paymentDate}</td>
                  <td>{formatMoney(p.amountCents)}</td>
                  <td>{p.paymentMethod}</td>
                  <td>{p.note || (p.patientName ? `${p.patientName} — ${p.workTypeLabel}` : '—')}</td>
                </tr>
              ))}
            </tbody>
          </PrintTable>
        )}
      </PrintSection>

      <PrintSection title={t('labCases.accounts.statement')}>
        {statement.length === 0 ? (
          <p className="muted">{t('labCases.accounts.noStatement')}</p>
        ) : (
          <PrintTable compact>
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('labCases.accounts.description')}</th>
                <th>{t('labCases.accounts.debit')}</th>
                <th>{t('labCases.accounts.credit')}</th>
                <th>{t('labCases.accounts.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {statement.map((line, i) => (
                <tr key={i}>
                  <td>{formatDateDisplay(line.date, language)}</td>
                  <td>{line.description}</td>
                  <td>{line.debitCents > 0 ? formatMoney(line.debitCents) : '—'}</td>
                  <td>{line.creditCents > 0 ? formatMoney(line.creditCents) : '—'}</td>
                  <td>{formatMoney(line.balanceCents)}</td>
                </tr>
              ))}
            </tbody>
          </PrintTable>
        )}
      </PrintSection>

      <PrintFooter />
    </PrintDocument>
  );
}
