import { useTranslation } from 'react-i18next';
import {
  PrintDocument,
  PrintFooter,
  PrintMetaItem,
  PrintMetaRow,
  PrintReportHeader,
  PrintSection,
  PrintTable,
} from '@/components/common/PrintLayout';
import { ClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { formatDateDisplay, todayIso } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import type { AdminLicensePayment } from '@/api/dibnova-admin.api';

export function OperatingContractPrintable({
  clinicName,
  clinicPhone,
  clinicId,
  mode,
  status,
  startedAt,
  expiresAt,
  priceCents,
  version,
  clinic,
  language,
}: {
  clinicName: string;
  clinicPhone: string;
  clinicId: string;
  mode: string;
  status: string;
  startedAt: string | null;
  expiresAt: string | null;
  priceCents: number;
  version: string;
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();
  return (
    <PrintDocument orientation="portrait">
      <PrintReportHeader
        clinic={clinic}
        title={t('dibnovaAdmin.contractTitle')}
        meta={
          <PrintMetaRow grid>
            <PrintMetaItem label={t('dibnovaAdmin.clinicName')} value={clinicName} />
            <PrintMetaItem label={t('receipt.date')} value={formatDateDisplay(todayIso(), language)} />
            <PrintMetaItem label={t('dibnovaAdmin.productVersion')} value={`DentalNova ${version}`} />
          </PrintMetaRow>
        }
      />
      <PrintSection title={t('dibnovaAdmin.contractDetails')}>
        <PrintTable compact>
          <tbody>
            <tr>
              <td>{t('dibnovaAdmin.clinicName')}</td>
              <td>{clinicName}</td>
            </tr>
            <tr>
              <td>{t('dibnovaAdmin.clinicPhone')}</td>
              <td>{clinicPhone || '—'}</td>
            </tr>
            <tr>
              <td>{t('dibnovaAdmin.installationId')}</td>
              <td>{clinicId}</td>
            </tr>
            <tr>
              <td>{t('dibnovaAdmin.deploymentMode')}</td>
              <td>{mode}</td>
            </tr>
            <tr>
              <td>{t('dibnovaAdmin.subscriptionStatus')}</td>
              <td>{status}</td>
            </tr>
            <tr>
              <td>{t('dibnovaAdmin.startDate')}</td>
              <td>{startedAt ? formatDateDisplay(startedAt.slice(0, 10), language) : '—'}</td>
            </tr>
            <tr>
              <td>{t('dibnovaAdmin.expiryDate')}</td>
              <td>{expiresAt ? formatDateDisplay(expiresAt.slice(0, 10), language) : '—'}</td>
            </tr>
            <tr>
              <td>{t('dibnovaAdmin.contractPrice')}</td>
              <td>{formatMoney(priceCents)}</td>
            </tr>
          </tbody>
        </PrintTable>
      </PrintSection>
      <p className="print-note">{t('dibnovaAdmin.contractNote')}</p>
      <PrintFooter />
    </PrintDocument>
  );
}

export function AdminPaymentReceiptPrintable({
  payment,
  clinicName,
  clinic,
  language,
}: {
  payment: AdminLicensePayment;
  clinicName: string;
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();
  return (
    <PrintDocument orientation="portrait">
      <PrintReportHeader
        clinic={clinic}
        title={t('dibnovaAdmin.paymentReceiptTitle')}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('dibnovaAdmin.clinicName')} value={clinicName} />
            <PrintMetaItem label={t('receipt.date')} value={formatDateDisplay(payment.paymentDate, language)} />
          </PrintMetaRow>
        }
      />
      <PrintSection title={t('dibnovaAdmin.paymentDetails')}>
        <PrintTable compact>
          <tbody>
            <tr>
              <td>{t('patientRecord.account.amount')}</td>
              <td>{formatMoney(payment.amountCents)}</td>
            </tr>
            <tr>
              <td>{t('patientRecord.account.method')}</td>
              <td>{payment.method}</td>
            </tr>
            <tr>
              <td>{t('common.status')}</td>
              <td>{payment.status}</td>
            </tr>
            {payment.note && (
              <tr>
                <td>{t('common.note')}</td>
                <td>{payment.note}</td>
              </tr>
            )}
          </tbody>
        </PrintTable>
      </PrintSection>
      <PrintFooter />
    </PrintDocument>
  );
}
