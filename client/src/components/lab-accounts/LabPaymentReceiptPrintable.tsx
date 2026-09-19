import { useTranslation } from 'react-i18next';
import {
  PrintDocument,
  PrintFooter,
  PrintMetaItem,
  PrintMetaRow,
  PrintReportHeader,
  PrintTotals,
} from '@/components/common/PrintLayout';
import { formatMoney } from '@/utils/money';
import { formatDateDisplay } from '@/utils/date';
import { ClinicPrintInfo } from '@/utils/clinicPrintInfo';
import type { LabAccountPaymentRow } from '@/types/domain';

export function LabPaymentReceiptPrintable({
  labName,
  payment,
  remainingCents,
  clinic,
  language,
}: {
  labName: string;
  payment: LabAccountPaymentRow;
  remainingCents: number;
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();
  const rows = [
    { label: t('common.date'), value: formatDateDisplay(payment.paymentDate, language) },
    { label: t('patientRecord.account.amount'), value: formatMoney(payment.amountCents), kind: 'emphasis' as const },
    { label: t('patientRecord.account.method'), value: payment.paymentMethod },
    ...(payment.note ? [{ label: t('common.note'), value: payment.note }] : []),
    {
      label: t('labCases.accounts.remaining'),
      value: formatMoney(remainingCents),
      kind: 'balance' as const,
    },
  ];

  return (
    <PrintDocument orientation="portrait">
      <PrintReportHeader
        clinic={clinic}
        title={t('labCases.accounts.paymentReceipt')}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('labCases.labName')} value={labName} />
            <PrintMetaItem label={t('receipt.receiptNumber')} value={`#${payment.id}`} />
          </PrintMetaRow>
        }
      />
      <PrintTotals rows={rows} />
      <PrintFooter note={t('receipt.issuedByClinic')} />
    </PrintDocument>
  );
}
