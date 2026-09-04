import { ReactNode } from 'react';
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
import { formatMoney, centsToAmount } from '@/utils/money';
import { todayIso, formatDateDisplay, formatDateTimeDisplay, calculateAge } from '@/utils/date';
import { ClinicPrintInfo } from '@/utils/clinicPrintInfo';
import {
  AccountSummary,
  AppointmentWithPatient,
  Patient,
  PatientAttachment,
  PatientTreatment,
  Payment,
  Prescription,
} from '@/types/domain';
import { expandTreatmentDisplayRows } from '@/utils/treatment-display';
import { Odontogram } from './odontogram/Odontogram';
import type { ToothTreatmentBadge } from './odontogram/types';

function TreatmentsTable({
  treatments,
  language,
  showStatus,
}: {
  treatments: PatientTreatment[];
  language: string;
  showStatus?: boolean;
}) {
  const { t } = useTranslation();
  const rows = expandTreatmentDisplayRows(treatments);
  if (rows.length === 0) {
    return <p className="muted">{t('patientRecord.account.noTreatments')}</p>;
  }
  return (
    <PrintTable>
      <thead>
        <tr>
          <th>{t('receipt.date')}</th>
          <th>{t('receipt.treatment')}</th>
          <th>{t('receipt.teeth')}</th>
          <th>{t('receipt.base')}</th>
          <th>{t('receipt.discount')}</th>
          <th>{t('receipt.final')}</th>
          {showStatus && <th>{t('receipt.status')}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
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
              {showStatus && <td>{t(`patientRecord.treatmentStatus.${tr.status}`)}</td>}
            </tr>
          );
        })}
      </tbody>
    </PrintTable>
  );
}

function PaymentsTable({ payments }: { payments: Payment[] }) {
  const { t } = useTranslation();
  if (payments.length === 0) {
    return <p className="muted">{t('patientRecord.account.noPayments')}</p>;
  }
  return (
    <PrintTable>
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
          <tr key={p.id}>
            <td>{p.date}</td>
            <td>{formatMoney(p.amountCents)}</td>
            <td>{p.methodLabel ?? p.method}</td>
            <td>{p.note || '—'}</td>
          </tr>
        ))}
      </tbody>
    </PrintTable>
  );
}

function financialTotalsRows(
  totals: {
    subtotalCents?: number;
    accountDiscountCents?: number;
    totalCostCents: number;
    totalPaidCents: number;
    remainingCents: number;
  },
  t: (key: string) => string,
) {
  const rows: { label: string; value: string; kind?: 'balance' | 'emphasis' }[] = [];
  if (totals.subtotalCents != null) {
    rows.push({ label: t('receipt.subtotal'), value: formatMoney(totals.subtotalCents) });
  }
  if (totals.accountDiscountCents != null) {
    rows.push({
      label: t('receipt.accountDiscount'),
      value:
        totals.accountDiscountCents > 0
          ? `-${formatMoney(totals.accountDiscountCents)}`
          : formatMoney(0),
    });
  }
  rows.push(
    { label: t('receipt.invoiceTotal'), value: formatMoney(totals.totalCostCents) },
    { label: t('receipt.paid'), value: formatMoney(totals.totalPaidCents) },
    { label: t('receipt.remaining'), value: formatMoney(totals.remainingCents), kind: 'balance' },
  );
  return rows;
}

/** Full invoice printout — used from the Invoice Details popup's Print action. */
export function InvoiceReceiptPrintable({
  patient,
  treatments,
  totals,
  clinic,
  language,
}: {
  patient: Patient;
  treatments: PatientTreatment[];
  totals: {
    subtotalCents?: number;
    accountDiscountCents?: number;
    totalCostCents: number;
    totalPaidCents: number;
    remainingCents: number;
  };
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();
  return (
    <PrintDocument orientation="landscape">
      <PrintReportHeader
        clinic={clinic}
        title={t('receipt.invoiceTitle')}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('receipt.patient')} value={patient.fullName} />
            <PrintMetaItem label={t('receipt.fileNumber')} value={patient.fileNumber} />
            <PrintMetaItem label={t('receipt.date')} value={formatDateDisplay(todayIso(), language)} />
          </PrintMetaRow>
        }
      />
      <PrintSection title={t('patientRecord.treatment.history')}>
        <TreatmentsTable treatments={treatments} language={language} showStatus />
      </PrintSection>
      <PrintTotals rows={financialTotalsRows(totals, t)} />
      <PrintFooter note={t('receipt.thankYou')} />
    </PrintDocument>
  );
}

/** Single-payment receipt — printed right after saving a payment, or from the Payment History popup. */
export function PaymentReceiptPrintable({
  patient,
  payment,
  remainingCents,
  clinic,
  language,
}: {
  patient: Patient;
  payment: Payment;
  remainingCents: number;
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();
  const rows = [
    { label: t('common.date'), value: formatDateDisplay(payment.date, language) },
    { label: t('patientRecord.account.amount'), value: formatMoney(payment.amountCents), kind: 'emphasis' as const },
    { label: t('patientRecord.account.method'), value: payment.methodLabel ?? payment.method },
    ...(payment.note ? [{ label: t('common.note'), value: payment.note }] : []),
    { label: t('receipt.remaining'), value: formatMoney(remainingCents), kind: 'balance' as const },
  ];
  return (
    <PrintDocument orientation="portrait">
      <PrintReportHeader
        clinic={clinic}
        title={t('receipt.title')}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('receipt.patient')} value={patient.fullName} />
            <PrintMetaItem label={t('receipt.fileNumber')} value={patient.fileNumber} />
            <PrintMetaItem label={t('receipt.receiptNumber')} value={`#${payment.id}`} />
          </PrintMetaRow>
        }
      />
      <PrintTotals rows={rows} />
      <PrintFooter note={t('receipt.thankYou')} />
    </PrintDocument>
  );
}

/** Full financial statement — clinic + patient identity, treatments, payments, totals, print date. */
export function AccountStatementPrintable({
  patient,
  treatments,
  payments,
  totals,
  clinic,
  language,
}: {
  patient: Patient;
  treatments: PatientTreatment[];
  payments: Payment[];
  totals: { totalCostCents: number; totalPaidCents: number; remainingCents: number };
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();
  return (
    <PrintDocument orientation="landscape">
      <PrintReportHeader
        clinic={clinic}
        title={t('statement.title')}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('receipt.patient')} value={patient.fullName} />
            <PrintMetaItem label={t('receipt.fileNumber')} value={patient.fileNumber} />
            <PrintMetaItem label={t('statement.printDate')} value={formatDateDisplay(todayIso(), language)} />
          </PrintMetaRow>
        }
      />
      <PrintSection title={t('patientRecord.treatment.history')}>
        <TreatmentsTable treatments={treatments} language={language} />
      </PrintSection>
      <PrintSection title={t('statement.paymentHistory')}>
        <PaymentsTable payments={payments} />
      </PrintSection>
      <PrintTotals rows={financialTotalsRows(totals, t)} />
      <PrintFooter />
    </PrintDocument>
  );
}

/** Complete patient file — patient identity, treatments, appointments, invoice/payments summary, files list. */
export function PatientFilePrintable({
  patient,
  areaLabel,
  treatments,
  appointments,
  summary,
  attachments,
  clinic,
  language,
}: {
  patient: Patient;
  areaLabel?: string | null;
  treatments: PatientTreatment[];
  appointments: AppointmentWithPatient[];
  summary: AccountSummary | null;
  attachments: PatientAttachment[];
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : patient.approxAge;

  return (
    <PrintDocument orientation="landscape">
      <PrintReportHeader
        clinic={clinic}
        title={t('patientFile.title')}
        meta={
          <>
            <p className="print-meta__date">
              {t('patientFile.printedOn')}: {formatDateDisplay(todayIso(), language)}
            </p>
            <PrintMetaRow grid>
              <PrintMetaItem label={t('receipt.patient')} value={patient.fullName} />
              <PrintMetaItem label={t('receipt.fileNumber')} value={patient.fileNumber} />
              <PrintMetaItem label={t('patientRecord.patient.phone')} value={patient.phone} />
              {patient.dateOfBirth && (
                <PrintMetaItem
                  label={t('patientRecord.patient.dob')}
                  value={formatDateDisplay(patient.dateOfBirth, language)}
                />
              )}
              {age != null && (
                <PrintMetaItem
                  label={t('patientRecord.patient.age')}
                  value={`${age} ${t('common.years')}`}
                />
              )}
              {patient.gender && (
                <PrintMetaItem label={t('patientRecord.patient.gender')} value={t(`gender.${patient.gender}`)} />
              )}
              {areaLabel && (
                <PrintMetaItem label={t('patientRecord.patient.area')} value={areaLabel} />
              )}
            </PrintMetaRow>
          </>
        }
      />

      {patient.generalNotes && (
        <PrintSection title={t('patientFile.patientInfo')}>
          <p>
            <strong>{t('patientRecord.patient.generalNotes')}:</strong> {patient.generalNotes}
          </p>
        </PrintSection>
      )}

      <PrintSection title={t('patientFile.treatments')}>
        <TreatmentsTable treatments={treatments} language={language} showStatus />
      </PrintSection>

      <PrintSection title={t('patientFile.appointments')}>
        {appointments.length === 0 ? (
          <p className="muted">{t('patientFile.noAppointments')}</p>
        ) : (
          <PrintTable compact>
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.time')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td>{formatDateDisplay(a.date, language)}</td>
                  <td>{a.time}</td>
                  <td>{t(`appointmentsPage.status.${a.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </PrintTable>
        )}
      </PrintSection>

      {summary && (
        <PrintSection title={t('patientFile.invoiceSummary')}>
          <PrintTotals rows={financialTotalsRows(summary, t)} />
        </PrintSection>
      )}

      <PrintSection title={t('patientFile.files')}>
        {attachments.length === 0 ? (
          <p className="muted">{t('patientFile.noFiles')}</p>
        ) : (
          <PrintTable compact>
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('patientRecord.files.category')}</th>
                <th>{t('common.note')}</th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((a) => (
                <tr key={a.id}>
                  <td>{formatDateTimeDisplay(a.createdAt, language)}</td>
                  <td>{t(`patientRecord.files.categories.${a.category}`)}</td>
                  <td>{a.originalFileName}</td>
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

/** Treatment plan / estimate — NOT a payment receipt or final invoice. */
export function TreatmentPlanEstimatePrintable({
  patient,
  treatments,
  totalCents,
  clinic,
  language,
}: {
  patient: Patient;
  treatments: PatientTreatment[];
  totalCents: number;
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();
  return (
    <PrintDocument orientation="landscape">
      <PrintReportHeader
        clinic={clinic}
        title={t('patientRecord.treatmentPlan.title')}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('receipt.patient')} value={patient.fullName} />
            <PrintMetaItem label={t('receipt.fileNumber')} value={patient.fileNumber} />
            <PrintMetaItem label={t('receipt.date')} value={formatDateDisplay(todayIso(), language)} />
          </PrintMetaRow>
        }
      />
      <p className="print-note">{t('patientRecord.treatmentPlan.disclaimer')}</p>
      <PrintSection title={t('patientRecord.treatmentPlan.title')}>
        <TreatmentsTable treatments={treatments} language={language} />
      </PrintSection>
      <PrintTotals
        rows={[{ label: t('patientRecord.treatmentPlan.total'), value: formatMoney(totalCents), kind: 'emphasis' }]}
      />
      <PrintFooter />
    </PrintDocument>
  );
}

/** Shared prescription sheet header (doctor + patient meta). */
function PrescriptionSheetShell({
  patient,
  clinic,
  language,
  dateIso,
  preview,
  sheetClassName,
  watermark,
  children,
}: {
  patient: Patient;
  clinic: ClinicPrintInfo;
  language: string;
  dateIso: string;
  preview?: boolean;
  sheetClassName: string;
  watermark: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const doctorNameEn = clinic.doctorNameEn ?? clinic.clinicName ?? '—';
  const doctorNameAr = clinic.doctorNameAr ?? doctorNameEn;
  const doctorTitleEn = clinic.doctorTitleEn ?? t('prescriptionPrint.doctorTitleDefault');
  const doctorTitleAr = clinic.doctorTitleAr ?? 'جراح في طب الأسنان';
  const weightLabel =
    patient.weightKg != null ? `${patient.weightKg} ${t('patientRecord.patient.weightUnit')}` : '—';

  return (
    <PrintDocument orientation="portrait" preview={preview}>
      <div className={sheetClassName}>
        <div className="prescription-sheet__watermark" aria-hidden="true">
          {watermark}
        </div>

        <header className="prescription-sheet__header">
          <div className="prescription-sheet__header-col prescription-sheet__header-col--ltr">
            <p className="prescription-sheet__doctor-en">{doctorNameEn}</p>
            <p className="prescription-sheet__title-en">{doctorTitleEn}</p>
            {clinic.doctorLicenseNo && (
              <p className="prescription-sheet__license-en">License: {clinic.doctorLicenseNo}</p>
            )}
          </div>
          <div className="prescription-sheet__header-col prescription-sheet__header-col--rtl">
            <p className="prescription-sheet__doctor-ar">{doctorNameAr}</p>
            <p className="prescription-sheet__title-ar">{doctorTitleAr}</p>
            {clinic.doctorLicenseNo && (
              <p className="prescription-sheet__license-ar">رقم النقابة: {clinic.doctorLicenseNo}</p>
            )}
          </div>
        </header>

        <div className="prescription-sheet__patient-row">
          <div className="prescription-sheet__patient-ltr">
            <span>{t('prescriptionPrint.patient')}:</span> <strong>{patient.fullName}</strong>
          </div>
          <div className="prescription-sheet__patient-rtl">
            <span>المريض:</span> <strong>{patient.fullName}</strong>
          </div>
        </div>

        <div className="prescription-sheet__meta-row">
          <span>
            {t('prescriptionPrint.weight')}: {weightLabel}
          </span>
          <span>
            {t('common.date')}: {formatDateDisplay(dateIso, language)}
          </span>
        </div>

        {children}

        <div className="prescription-sheet__signature">
          <div className="prescription-sheet__stamp-area">
            <span className="prescription-sheet__stamp-label">{t('prescriptionPrint.stamp')}</span>
          </div>
          <div className="prescription-sheet__sign-area">
            <span className="prescription-sheet__sign-line" />
            <span className="prescription-sheet__sign-label">{t('prescriptionPrint.signature')}</span>
          </div>
        </div>

        <footer className="prescription-sheet__footer">
          {[clinic.address, clinic.clinicPhone].filter(Boolean).join(' · ')}
        </footer>
      </div>
    </PrintDocument>
  );
}

function ToothWatermarkIcon() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M32 4c-8 0-14 6-14 14 0 5 2 9 6 12-6 3-10 9-10 16 0 10 8 18 18 18s18-8 18-18c0-7-4-13-10-16 4-3 6-7 6-12 0-8-6-14-14-14zm0 8c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6 2.7-6 6-6zm-10 28c0-5 4-9 10-9s10 4 10 9c0 5.5-4.5 10-10 10s-10-4.5-10-10z"
        fill="currentColor"
      />
    </svg>
  );
}

function XrayWatermarkIcon() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="12" width="48" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="32" cy="32" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M32 22v20M22 32h20" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Professional medicine prescription printout — bilingual A5 portrait sheet. */
export function PrescriptionPrintable({
  patient,
  prescription,
  clinic,
  language,
  preview,
}: {
  patient: Patient;
  prescription: Prescription;
  clinic: ClinicPrintInfo;
  language: string;
  preview?: boolean;
}) {
  const dateIso = prescription.createdAt.slice(0, 10);

  return (
    <PrescriptionSheetShell
      patient={patient}
      clinic={clinic}
      language={language}
      dateIso={dateIso}
      preview={preview}
      sheetClassName="prescription-sheet prescription-sheet--medication"
      watermark={<ToothWatermarkIcon />}
    >
      <div className="prescription-sheet__rx-symbol">℞</div>

      <ol className="prescription-sheet__medicines">
        {prescription.items.map((item, index) => {
          const detailParts = [item.dose, item.frequency, item.duration].filter(Boolean);
          return (
            <li key={item.id ?? index} className="prescription-sheet__medicine">
              <p className="prescription-sheet__medicine-name">{item.medicineName}</p>
              {detailParts.length > 0 && (
                <p className="prescription-sheet__medicine-details">{detailParts.join(' · ')}</p>
              )}
              {item.instructions && (
                <p className="prescription-sheet__medicine-instructions">{item.instructions}</p>
              )}
            </li>
          );
        })}
      </ol>
    </PrescriptionSheetShell>
  );
}

/** X-ray imaging request printout — distinct layout from medicine prescription. */
export function XrayPrescriptionPrintable({
  patient,
  prescription,
  clinic,
  language,
  preview,
}: {
  patient: Patient;
  prescription: Prescription;
  clinic: ClinicPrintInfo;
  language: string;
  preview?: boolean;
}) {
  const { t } = useTranslation();
  const dateIso = prescription.createdAt.slice(0, 10);

  return (
    <PrescriptionSheetShell
      patient={patient}
      clinic={clinic}
      language={language}
      dateIso={dateIso}
      preview={preview}
      sheetClassName="prescription-sheet prescription-sheet--xray"
      watermark={<XrayWatermarkIcon />}
    >
      <div className="prescription-sheet__xray-heading">
        <span className="prescription-sheet__xray-heading-en">{t('xrayPrescriptionPrint.title')}</span>
        <span className="prescription-sheet__xray-heading-ar">{t('xrayPrescriptionPrint.titleAr')}</span>
      </div>

      <ol className="prescription-sheet__studies">
        {prescription.items.map((item, index) => (
          <li key={item.id ?? index} className="prescription-sheet__study">
            <p className="prescription-sheet__study-name">{item.medicineName}</p>
            {item.dose && (
              <p className="prescription-sheet__study-teeth">
                {t('xrayPrescriptionPrint.teeth')}: {item.dose}
              </p>
            )}
            {item.instructions && <p className="prescription-sheet__study-notes">{item.instructions}</p>}
          </li>
        ))}
      </ol>
    </PrescriptionSheetShell>
  );
}

/** A5 portrait patient record — identity, account, odontogram with treatment tags. */
export function PatientRecordPrintable({
  patient,
  summary,
  toothMap,
  clinic,
  language,
}: {
  patient: Patient;
  treatments?: PatientTreatment[];
  summary: AccountSummary;
  toothMap: Map<number, ToothTreatmentBadge[]>;
  clinic: ClinicPrintInfo;
  language: string;
}) {
  const { t } = useTranslation();
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : patient.approxAge;
  const weightLabel =
    patient.weightKg != null ? `${patient.weightKg} ${t('patientRecord.patient.weightUnit')}` : '—';

  return (
    <PrintDocument orientation="portrait" className="print-doc--patient-record">
      <PrintReportHeader
        clinic={clinic}
        title={t('patientRecordPrint.title')}
        meta={
          <PrintMetaRow grid>
            <PrintMetaItem label={t('receipt.patient')} value={patient.fullName} />
            <PrintMetaItem label={t('receipt.fileNumber')} value={patient.fileNumber} />
            {age != null && (
              <PrintMetaItem label={t('patientRecord.patient.age')} value={`${age} ${t('common.years')}`} />
            )}
            <PrintMetaItem label={t('patientRecord.patient.weight')} value={weightLabel} />
            <PrintMetaItem
              label={t('patientRecordPrint.fileDate')}
              value={formatDateDisplay(patient.createdAt.slice(0, 10), language)}
            />
            <PrintMetaItem label={t('receipt.date')} value={formatDateDisplay(todayIso(), language)} />
          </PrintMetaRow>
        }
      />

      <PrintSection title={t('patientRecordPrint.account')}>
        <PrintTotals
          rows={[
            {
              label: t('patientRecordPrint.total'),
              value: formatMoney(summary.subtotalCents ?? summary.totalCostCents),
            },
            {
              label: t('patientRecordPrint.discount'),
              value:
                (summary.accountDiscountCents ?? 0) > 0
                  ? `-${formatMoney(summary.accountDiscountCents ?? 0)}`
                  : formatMoney(0),
            },
            { label: t('patientRecordPrint.paid'), value: formatMoney(summary.totalPaidCents) },
            {
              label: t('patientRecordPrint.remaining'),
              value: formatMoney(summary.remainingCents),
              kind: 'balance',
            },
          ]}
        />
      </PrintSection>

      <PrintSection title={t('patientRecordPrint.odontogram')}>
        <div className="print-odontogram">
          <Odontogram
            toothMap={toothMap}
            selectable={false}
            selectedTeeth={[]}
            onToggleTooth={() => undefined}
            printLayout
          />
        </div>
      </PrintSection>

      <PrintFooter />
    </PrintDocument>
  );
}
