import {
  ODONTOGRAM_LOWER_LEFT,
  ODONTOGRAM_LOWER_RIGHT,
  ODONTOGRAM_UPPER_LEFT,
  ODONTOGRAM_UPPER_RIGHT,
} from './constants';
import { ToothCell } from './ToothCell';
import type { OdontogramProps } from './types';
import './odontogram.css';

function QuadrantRow({
  teeth,
  arch,
  toothMap,
  selectable,
  selected,
  onToggleTooth,
  printLayout,
}: {
  teeth: readonly number[];
  arch: 'upper' | 'lower';
  toothMap: OdontogramProps['toothMap'];
  selectable: boolean;
  selected: Set<number>;
  onToggleTooth: OdontogramProps['onToggleTooth'];
  printLayout?: boolean;
}) {
  return (
    <>
      {teeth.map((n) => (
        <ToothCell
          key={n}
          number={n}
          arch={arch}
          selectable={selectable}
          selected={selected.has(n)}
          treatments={toothMap.get(n) ?? []}
          onToggle={onToggleTooth}
          printLayout={printLayout}
        />
      ))}
    </>
  );
}

export function Odontogram({
  toothMap,
  selectable,
  selectedTeeth,
  onToggleTooth,
  printLayout = false,
}: OdontogramProps) {
  const selected = new Set(selectedTeeth);
  const shared = { toothMap, selectable, onToggleTooth, selected, printLayout };

  return (
    <div className="do-chart" data-odontogram="v5" data-print={printLayout ? 'true' : undefined}>
      <div className="do-arch do-arch--upper">
        <div className="do-quadrant do-quadrant--right">
          <QuadrantRow teeth={ODONTOGRAM_UPPER_RIGHT} arch="upper" {...shared} />
        </div>
        <div className="do-vline" aria-hidden="true" />
        <div className="do-quadrant do-quadrant--left">
          <QuadrantRow teeth={ODONTOGRAM_UPPER_LEFT} arch="upper" {...shared} />
        </div>
      </div>

      <div className="do-arch do-arch--lower">
        <div className="do-quadrant do-quadrant--right">
          <QuadrantRow teeth={ODONTOGRAM_LOWER_RIGHT} arch="lower" {...shared} />
        </div>
        <div className="do-vline" aria-hidden="true" />
        <div className="do-quadrant do-quadrant--left">
          <QuadrantRow teeth={ODONTOGRAM_LOWER_LEFT} arch="lower" {...shared} />
        </div>
      </div>
    </div>
  );
}
