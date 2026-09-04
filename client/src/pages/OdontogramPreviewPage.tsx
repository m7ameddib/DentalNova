import { useMemo, useState } from 'react';

import { Odontogram } from '@/components/patient-record/odontogram/Odontogram';

import { ToothCell } from '@/components/patient-record/odontogram/ToothCell';

import type { ToothTreatmentBadge } from '@/components/patient-record/odontogram/types';

import { ALL_TEETH, isLowerTooth } from '@/utils/teeth';

import '@/components/patient-record/odontogram/odontogram.css';



/**

 * Standalone preview — all 32 FDI teeth with ZoliQua measured SVG art.

 * Route: /odontogram-preview (no auth required).

 */

export function OdontogramPreviewPage() {

  const [selected, setSelected] = useState<number[]>([11, 16, 26, 36, 46]);



  const toothMap = useMemo(() => {

    const map = new Map<number, ToothTreatmentBadge[]>();

    for (const n of selected) {

      map.set(n, [{ abbreviation: 'F', colorHex: '#2563eb', completed: n % 2 === 0 }]);

    }

    return map;

  }, [selected]);



  return (

    <div className="odontogram-preview-page">

      <header className="odontogram-preview-page__header">

        <h1>Odontogram Preview — 32 FDI Teeth</h1>

        <p className="muted">

          Anatomical SVG templates from{' '}

          <a href="https://github.com/ZoliQua/React-Odontogram-Modul" target="_blank" rel="noreferrer">

            React-Odontogram-Modul

          </a>{' '}

          (ZoliQua). Click teeth to toggle. Selected:{' '}

          {selected.length ? selected.sort((a, b) => a - b).join(', ') : 'none'}

        </p>

      </header>



      <section className="odontogram-preview-page__reference">

        <h2>Reference (React-Odontogram-Modul)</h2>

        <iframe

          title="React-Odontogram-Modul reference"

          src="https://react-odontogram-modul.vercel.app/"

          className="odontogram-preview-page__reference-frame"

        />

      </section>



      <section className="odontogram-preview-page__chart">

        <Odontogram

          toothMap={toothMap}

          selectable

          selectedTeeth={selected}

          onToggleTooth={(n) =>

            setSelected((prev) => (prev.includes(n) ? prev.filter((t) => t !== n) : [...prev, n]))

          }

        />

      </section>



      <section className="odontogram-preview-page__strip" aria-label="All 32 teeth in sequence">

        <h2>All {ALL_TEETH.length} teeth (FDI order)</h2>

        <div className="odontogram-preview-page__strip-inner">

          {ALL_TEETH.map((n) => (

            <ToothCell
              key={n}
              number={n}
              arch={isLowerTooth(n) ? 'lower' : 'upper'}
              selectable={false}
              selected={false}
              treatments={toothMap.get(n) ?? []}
            />

          ))}

        </div>

      </section>

    </div>

  );

}

