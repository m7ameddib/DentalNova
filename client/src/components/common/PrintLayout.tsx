import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { useUiStore } from '@/store/ui.store';

export type PrintOrientation = 'portrait' | 'landscape';

/** Root wrapper — sets A5 page orientation for browser print. */
export function PrintDocument({
  orientation = 'portrait',
  children,
  preview,
  className,
}: {
  orientation?: PrintOrientation;
  children: ReactNode;
  /** On-screen preview (e.g. prescription builder) — applies print styling without @media print. */
  preview?: boolean;
  className?: string;
}) {
  const classes = [
    'print-doc',
    orientation === 'landscape' ? 'print-doc--landscape' : 'print-doc--portrait',
    preview ? 'print-doc--preview' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <div className={classes}>{children}</div>;
}

/** Approved prescription-style header — Settings-linked, one language only. */
export function ApprovedPrintHeader({ clinic }: { clinic: ClinicPrintInfo }) {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const isAr = language.startsWith('ar');
  const doctorName = isAr
    ? clinic.doctorNameAr || clinic.doctorNameEn || clinic.clinicName || '—'
    : clinic.doctorNameEn || clinic.clinicName || clinic.doctorNameAr || '—';
  const doctorTitle = isAr
    ? clinic.doctorTitleAr || t('prescriptionPrint.doctorTitleDefaultAr')
    : clinic.doctorTitleEn || t('prescriptionPrint.doctorTitleDefault');
  const licenseLabel = isAr ? t('prescriptionPrint.licenseAr') : t('prescriptionPrint.license');

  return (
    <header
      className={[
        'prescription-sheet__header',
        'prescription-sheet__header--single',
        isAr ? 'prescription-sheet__header--rtl' : 'prescription-sheet__header--ltr',
      ].join(' ')}
    >
      <div className="prescription-sheet__header-col">
        <p className={isAr ? 'prescription-sheet__doctor-ar' : 'prescription-sheet__doctor-en'}>{doctorName}</p>
        <p className={isAr ? 'prescription-sheet__title-ar' : 'prescription-sheet__title-en'}>{doctorTitle}</p>
        {clinic.doctorLicenseNo && (
          <p className={isAr ? 'prescription-sheet__license-ar' : 'prescription-sheet__license-en'}>
            {licenseLabel}: {clinic.doctorLicenseNo}
          </p>
        )}
      </div>
    </header>
  );
}

/** Unified clinic + report title header used on every printable document. */
export function PrintReportHeader({
  clinic,
  title,
  meta,
}: {
  clinic: ClinicPrintInfo;
  title?: string;
  meta?: ReactNode;
}) {
  return (
    <div className="print-header print-header--approved">
      <ApprovedPrintHeader clinic={clinic} />
      {title && (
        <div className="print-header__title-block">
          <h1 className="print-header__title">{title}</h1>
        </div>
      )}
      {meta && <div className="print-header__meta">{meta}</div>}
    </div>
  );
}

/** Meta row helper — label/value pairs below the report title. */
export function PrintMetaRow({ children, grid }: { children: ReactNode; grid?: boolean }) {
  return <div className={grid ? 'print-meta print-meta--grid' : 'print-meta'}>{children}</div>;
}

export function PrintMetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="print-meta__item">
      <span className="print-meta__label">{label}</span>
      <span className="print-meta__value">{value}</span>
    </span>
  );
}

/** Section with title — keeps tables grouped for page-break control. */
export function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="print-section">
      <h2 className="print-section__title">{title}</h2>
      {children}
    </section>
  );
}

/** Highlighted totals / summary block. */
export function PrintTotals({
  rows,
}: {
  rows: { label: string; value: ReactNode; kind?: 'default' | 'emphasis' | 'balance' }[];
}) {
  return (
    <div className="print-totals">
      {rows.map((row, index) => {
        const kind = row.kind ?? 'default';
        return (
          <div key={`${row.label}-${index}`} className={`print-totals__row print-totals__row--${kind}`}>
            <span className="print-totals__label">{row.label}</span>
            <span className="print-totals__value">{row.value}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Professional footer — optional note. Branding is omitted unless explicitly requested. */
export function PrintFooter({ note, showBrand }: { note?: string; showBrand?: boolean }) {
  const { t } = useTranslation();
  return (
    <footer className="print-footer">
      {note && <p className="print-footer__note">{note}</p>}
      {showBrand && <p className="print-footer__brand">{t('printLayout.poweredBy')}</p>}
    </footer>
  );
}

/** Compact data table — inherits print-table styles. */
export function PrintTable({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return (
    <table className={compact ? 'print-table print-table--compact' : 'print-table'}>{children}</table>
  );
}
