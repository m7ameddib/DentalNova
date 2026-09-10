import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Receipt, Printer, MessageCircle } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { patientsApi } from '@/api/patients.api';
import { settingsApi } from '@/api/settings.api';
import { formatMoney, centsToAmount } from '@/utils/money';
import { formatDateDisplay } from '@/utils/date';
import { useUiStore } from '@/store/ui.store';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { openWhatsApp } from '@/utils/whatsapp';
import { InvoiceReceiptPrintable } from './PrintableTemplates';
import { expandTreatmentDisplayRows } from '@/utils/treatment-display';
import { Patient } from '@/types/domain';

export function InvoiceDetailsModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const print = usePrintStore((s) => s.print);

  const { data: summary } = useQuery({
    queryKey: ['account-summary', patient.id],
    queryFn: () => patientsApi.accountSummary(patient.id),
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ['patient-treatments', patient.id],
    queryFn: () => patientsApi.treatments(patient.id),
  });

  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => settingsApi.getClinic(),
  });

  const billedTreatments = useMemo(
    () => treatments.filter((treatment) => treatment.status === 'COMPLETED'),
    [treatments],
  );
  const displayRows = useMemo(() => expandTreatmentDisplayRows(billedTreatments), [billedTreatments]);

  const totals = useMemo(() => {
    if (!summary) return null;
    return {
      subtotalCents: summary.subtotalCents,
      accountDiscountCents: summary.accountDiscountCents,
      totalCostCents: summary.totalCostCents,
      totalPaidCents: summary.totalPaidCents,
      remainingCents: summary.remainingCents,
    };
  }, [summary]);

  async function handlePrint() {
    if (!totals) return;
    const clinic = await loadClinicPrintInfo();
    print(
      <InvoiceReceiptPrintable
        patient={patient}
        treatments={billedTreatments}
        totals={totals}
        clinic={clinic}
        language={language}
      />,
    );
  }

  function handleWhatsApp() {
    if (!totals) return;
    const message = t('whatsapp.invoiceSummary', {
      clinicName: clinicSettings?.clinicName || t('app.name'),
      patientName: patient.fullName,
      total: formatMoney(totals.totalCostCents),
      paid: formatMoney(totals.totalPaidCents),
      remaining: formatMoney(totals.remainingCents),
    });
    openWhatsApp(patient.phone, message);
  }

  const whatsappDisabled = !patient.phone || !totals;

  return (
    <Modal title={t('patientRecord.account.viewInvoice')} icon={<Receipt size={16} />} onClose={onClose} size="wide">
      <div className="invoice-detail">
        {displayRows.length === 0 ? (
          <p className="muted">{t('patientRecord.account.noTreatments')}</p>
        ) : (
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>{t('patientRecord.treatment.columns.date')}</th>
                <th>{t('patientRecord.treatment.columns.treatment')}</th>
                <th>{t('patientRecord.treatment.columns.teeth')}</th>
                <th>{t('patientRecord.treatment.columns.base')}</th>
                <th>{t('patientRecord.treatment.columns.discount')}</th>
                <th>{t('patientRecord.treatment.columns.final')}</th>
                <th>{t('patientRecord.treatment.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const tr = row.treatment;
                const treatmentLabel = t(`patientRecord.treatmentTypes.${tr.treatmentCode}`, {
                  defaultValue: tr.treatmentLabel,
                });
                return (
                  <tr key={row.key}>
                    <td>{formatDateDisplay(tr.treatmentDate ?? tr.createdAt.slice(0, 10), language)}</td>
                    <td>
                      {row.tooth != null
                        ? t('patientRecord.treatment.toothTreatmentLine', {
                            tooth: row.tooth,
                            treatment: treatmentLabel,
                          })
                        : treatmentLabel}
                    </td>
                    <td>
                      {row.tooth != null
                        ? t('patientRecord.treatment.toothLine', { tooth: row.tooth })
                        : tr.teeth.length > 0
                          ? tr.teeth.join(', ')
                          : '—'}
                    </td>
                    <td>{formatMoney(row.baseAmountCents)}</td>
                    <td>{row.discountCents > 0 ? `-${centsToAmount(row.discountCents).toFixed(2)}` : '—'}</td>
                    <td>{formatMoney(row.finalAmountCents)}</td>
                    <td>
                      <span className={`status-chip status-chip--${tr.status.toLowerCase()}`}>
                        {t(`patientRecord.treatmentStatus.${tr.status}`)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {totals && (
          <div className="invoice-detail__totals">
            <div className="treatment-price-breakdown__row">
              <span className="muted">{t('patientRecord.account.subtotal')}</span>
              <span>{formatMoney(totals.subtotalCents)}</span>
            </div>
            <div className="treatment-price-breakdown__row">
              <span className="muted">{t('patientRecord.account.accountDiscount')}</span>
              <span>
                {totals.accountDiscountCents > 0
                  ? `-${formatMoney(totals.accountDiscountCents)}`
                  : formatMoney(0)}
              </span>
            </div>
            <div className="treatment-price-breakdown__row">
              <span className="muted">{t('patientRecord.account.totalCost')}</span>
              <span>{formatMoney(totals.totalCostCents)}</span>
            </div>
            <div className="treatment-price-breakdown__row">
              <span className="muted">{t('patientRecord.account.paid')}</span>
              <span>{formatMoney(totals.totalPaidCents)}</span>
            </div>
            <div className="treatment-price-breakdown__row treatment-price-breakdown__row--final">
              <span>{t('patientRecord.account.remaining')}</span>
              <span>{formatMoney(totals.remainingCents)}</span>
            </div>
          </div>
        )}

        <div className="form-actions form-actions--start">
          <button type="button" className="btn btn--ghost btn--small" onClick={handlePrint}>
            <Printer size={13} /> {t('patientRecord.account.printReceipt')}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small btn--whatsapp"
            onClick={handleWhatsApp}
            disabled={whatsappDisabled}
            title={!patient.phone ? t('whatsapp.noPhone') ?? '' : ''}
          >
            <MessageCircle size={13} /> {t('whatsapp.sendSummary')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
