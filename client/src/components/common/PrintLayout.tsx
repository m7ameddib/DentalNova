import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ClinicPrintInfo } from '@/utils/clinicPrintInfo';

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

/** Unified clinic + report title header used on every printable document. */
export function PrintReportHeader({
  clinic,
  title,
  meta,
}: {
  clinic: ClinicPrintInfo;
  title: string;
  meta?: ReactNode;
}) {
  const hasClinic = clinic.clinicName || clinic.clinicPhone || clinic.address || clinic.logoUrl;
  return (
    <header className="print-header">
      {hasClinic && (
        <div className="print-header__brand">
          {clinic.logoUrl && (
            <img src={clinic.logoUrl} alt="" className="print-header__logo" />
          )}
          <div className="print-header__clinic">
            {clinic.clinicName && <p className="print-header__clinic-name">{clinic.clinicName}</p>}
            {(clinic.clinicPhone || clinic.address) && (
              <p className="print-header__clinic-contact">
                {[clinic.clinicPhone, clinic.address].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}
      <div className="print-header__title-block">
        <h1 className="print-header__title">{title}</h1>
        {meta && <div className="print-header__meta">{meta}</div>}
      </div>
    </header>
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

/** Professional footer — optional note + DibNova branding. */
export function PrintFooter({ note }: { note?: string }) {
  const { t } = useTranslation();
  return (
    <footer className="print-footer">
      {note && <p className="print-footer__note">{note}</p>}
      <p className="print-footer__brand">{t('printLayout.poweredBy')}</p>
    </footer>
  );
}

/** Compact data table — inherits print-table styles. */
export function PrintTable({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return (
    <table className={compact ? 'print-table print-table--compact' : 'print-table'}>{children}</table>
  );
}
