import { useTranslation } from 'react-i18next';
import { QUADRANTS } from '@/utils/teeth';
import { Odontogram } from './odontogram/Odontogram';
import type { ToothTreatmentBadge } from './odontogram/types';

export type { ToothTreatmentBadge };

interface DentalChartProps {
  toothMap: Map<number, ToothTreatmentBadge[]>;
  selectable: boolean;
  selectedTeeth: number[];
  onToggleTooth: (n: number) => void;
  /** Full anatomical odontogram for patient treatment section. */
  anatomical?: boolean;
}

function SimpleToothShape({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg viewBox="0 0 24 30" className="tooth__shape" aria-hidden="true">
      <path
        d="M12 1.2 C 16.8 1.2 20.2 4.3 20.2 8.8 C 20.2 11.6 19.2 13.4 18.1 15.3 C 17.2 16.9 17.6 19.6 17.2 23 C 16.9 25.8 15.7 27.8 14.3 27.8 C 13.1 27.8 12.7 25.2 12.4 22.1 C 12.3 20.7 12.2 19.4 12 19.4 C 11.8 19.4 11.7 20.7 11.6 22.1 C 11.3 25.2 10.9 27.8 9.7 27.8 C 8.3 27.8 7.1 25.8 6.8 23 C 6.4 19.6 6.8 16.9 5.9 15.3 C 4.8 13.4 3.8 11.6 3.8 8.8 C 3.8 4.3 7.2 1.2 12 1.2 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SimpleToothButton({
  number,
  selectable,
  selected,
  treatments,
  onClick,
}: {
  number: number;
  selectable: boolean;
  selected: boolean;
  treatments: ToothTreatmentBadge[];
  onClick?: (n: number) => void;
}) {
  const treated = treatments.length > 0;
  const fill = selected ? 'var(--color-primary-soft)' : treated ? `${treatments[0].colorHex}1f` : '#ffffff';
  const stroke = selected ? 'var(--color-primary)' : treated ? treatments[0].colorHex : '#94a3b8';
  const lower = number >= 31 && number <= 48;

  return (
    <button
      type="button"
      className={['tooth', lower ? 'tooth--lower' : 'tooth--upper', selectable ? 'tooth--selectable' : '', selected ? 'tooth--selected' : '', treated ? 'tooth--treated' : ''].filter(Boolean).join(' ')}
      onClick={() => selectable && onClick?.(number)}
      disabled={!selectable}
      title={String(number)}
    >
      {!lower && <span className="tooth__number">{number}</span>}
      <SimpleToothShape fill={fill} stroke={stroke} />
      {lower && <span className="tooth__number">{number}</span>}
      <span className="tooth__codes">
        {treatments.map((tr, i) => (
          <span key={i} className="tooth__code" style={{ backgroundColor: tr.colorHex }} title={tr.abbreviation}>
            {tr.abbreviation}
          </span>
        ))}
      </span>
    </button>
  );
}

export function DentalChart({ toothMap, selectable, selectedTeeth, onToggleTooth, anatomical }: DentalChartProps) {
  const { t } = useTranslation();

  if (anatomical) {
    return (
      <Odontogram
        toothMap={toothMap}
        selectable={selectable}
        selectedTeeth={selectedTeeth}
        onToggleTooth={onToggleTooth}
      />
    );
  }

  const selected = new Set(selectedTeeth);

  function renderQuadrant(numbers: readonly number[], arch: 'upper' | 'lower') {
    return (
      <div className={`quadrant quadrant--${arch}`}>
        {numbers.map((n) => (
          <SimpleToothButton
            key={n}
            number={n}
            selectable={selectable}
            selected={selected.has(n)}
            treatments={toothMap.get(n) ?? []}
            onClick={onToggleTooth}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="dental-chart">
      <div className="dental-chart__row dental-chart__row--upper">
        <div className="quadrant-block quadrant-block--upper">
          <span className="quadrant-block__label">{t('patientRecord.treatment.quadrantUpperRight')}</span>
          {renderQuadrant(QUADRANTS.upperRight, 'upper')}
        </div>
        <div className="quadrant-block quadrant-block--upper">
          <span className="quadrant-block__label">{t('patientRecord.treatment.quadrantUpperLeft')}</span>
          {renderQuadrant(QUADRANTS.upperLeft, 'upper')}
        </div>
      </div>
      <div className="dental-chart__midline" aria-hidden="true" />
      <div className="dental-chart__row dental-chart__row--lower">
        <div className="quadrant-block quadrant-block--lower">
          {renderQuadrant(QUADRANTS.lowerRight, 'lower')}
          <span className="quadrant-block__label">{t('patientRecord.treatment.quadrantLowerRight')}</span>
        </div>
        <div className="quadrant-block quadrant-block--lower">
          {renderQuadrant(QUADRANTS.lowerLeft, 'lower')}
          <span className="quadrant-block__label">{t('patientRecord.treatment.quadrantLowerLeft')}</span>
        </div>
      </div>
    </div>
  );
}
