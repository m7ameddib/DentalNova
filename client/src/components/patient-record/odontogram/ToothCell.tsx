import { getToothAnatomyType } from '@/utils/teeth';
import { getCellWidth, getGraphicSlotHeight } from './zoliqua-teeth-data';
import { ToothGraphic } from './ToothGraphic';
import type { ToothTreatmentBadge } from './types';

interface ToothCellProps {
  number: number;
  arch?: 'upper' | 'lower';
  selectable: boolean;
  selected: boolean;
  treatments: ToothTreatmentBadge[];
  onToggle?: (n: number) => void;
  printLayout?: boolean;
}

/**
 * One tooth column: realistic tooth shape (clickable/selectable) → FDI
 * number directly under it → treatment abbreviation(s) stacked under the
 * number, each with a ✓ only when that treatment is Completed.
 */
export function ToothCell({
  number,
  arch = 'upper',
  selectable,
  selected,
  treatments,
  onToggle,
  printLayout = false,
}: ToothCellProps) {
  const width = getCellWidth(number, printLayout);
  const pos = number % 10;
  const isMidline = number === 11 || number === 21 || number === 31 || number === 41;
  const slotHeight = getGraphicSlotHeight(printLayout);

  return (
    <div
      className={[
        'do-cell',
        `do-cell--${arch}`,
        `do-cell--${getToothAnatomyType(number)}`,
        isMidline ? 'do-cell--midline' : '',
        printLayout ? 'do-cell--print' : '',
        selected ? 'do-cell--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width, minWidth: width, maxWidth: width }}
      data-tooth={number}
      data-pos={pos}
    >
      <div className="do-cell__graphic-slot" style={{ height: slotHeight }}>
        <button
          type="button"
          className={[
            'do-cell__btn',
            selectable ? 'do-cell__btn--selectable' : '',
            selected ? 'do-cell__btn--selected' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => selectable && onToggle?.(number)}
          disabled={!selectable}
          aria-label={`Tooth ${number}`}
          aria-pressed={selectable ? selected : undefined}
          title={String(number)}
        >
          <ToothGraphic toothNumber={number} selected={selected} printLayout={printLayout} />
        </button>
      </div>

      <div className="do-cell__labels">
        <div className="do-cell__num">{number}</div>

        {treatments.length > 0 && (
          <div className={['do-cell__treatments', printLayout ? 'do-cell__treatments--print' : '']
            .filter(Boolean)
            .join(' ')}>
            {treatments.map((tr, i) => (
              <span
                key={i}
                className="do-cell__tx"
                style={{ color: tr.colorHex }}
                title={tr.abbreviation}
              >
                {tr.abbreviation}
                {tr.completed && <span className="do-cell__tx-check">✓</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
