import { PatientTreatment, TreatmentScope } from '@/types/domain';

export interface TreatmentDisplayRow {
  key: string;
  treatment: PatientTreatment;
  tooth: number | null;
  baseAmountCents: number;
  discountCents: number;
  finalAmountCents: number;
}

/** Expands multi-tooth SINGLE-scope treatments into one row per tooth for display. */
export function expandTreatmentDisplayRows(treatments: PatientTreatment[]): TreatmentDisplayRow[] {
  const rows: TreatmentDisplayRow[] = [];

  for (const treatment of treatments) {
    if (treatment.status === 'VOID') continue;

    const scope = (treatment.treatmentScope ?? 'SINGLE') as TreatmentScope;
    const teeth =
      treatment.teeth.length > 0
        ? [...treatment.teeth].sort((a, b) => a - b)
        : treatment.toothNumber
          ? [treatment.toothNumber]
          : [];

    if (scope === 'SINGLE' && teeth.length > 1) {
      const count = teeth.length;
      const baseShare = Math.floor(treatment.baseAmountCents / count);
      const discountShare = Math.floor(treatment.discountCents / count);
      const finalShare = Math.floor(treatment.finalAmountCents / count);
      let baseRemainder = treatment.baseAmountCents - baseShare * count;
      let discountRemainder = treatment.discountCents - discountShare * count;
      let finalRemainder = treatment.finalAmountCents - finalShare * count;

      for (const tooth of teeth) {
        const base = baseShare + (baseRemainder > 0 ? 1 : 0);
        const discount = discountShare + (discountRemainder > 0 ? 1 : 0);
        const final = finalShare + (finalRemainder > 0 ? 1 : 0);
        if (baseRemainder > 0) baseRemainder--;
        if (discountRemainder > 0) discountRemainder--;
        if (finalRemainder > 0) finalRemainder--;

        rows.push({
          key: `${treatment.id}-${tooth}`,
          treatment,
          tooth,
          baseAmountCents: base,
          discountCents: discount,
          finalAmountCents: final,
        });
      }
    } else {
      rows.push({
        key: String(treatment.id),
        treatment,
        tooth: teeth.length === 1 ? teeth[0] : null,
        baseAmountCents: treatment.baseAmountCents,
        discountCents: treatment.discountCents,
        finalAmountCents: treatment.finalAmountCents,
      });
    }
  }

  return rows;
}

export function formatTreatmentToothLabel(
  row: TreatmentDisplayRow,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (row.tooth != null) {
    return t('patientRecord.treatment.toothLine', { tooth: row.tooth });
  }
  const teeth = row.treatment.teeth;
  if (teeth.length > 0) return teeth.join(', ');
  return '—';
}

function treatmentTeeth(treatment: PatientTreatment): number[] {
  if (treatment.teeth.length > 0) return treatment.teeth;
  if (treatment.toothNumber) return [treatment.toothNumber];
  return [];
}

/** True when deleting this history row should remove one tooth, not the whole treatment. */
export function isPartialToothRemoval(row: TreatmentDisplayRow): boolean {
  if (row.tooth == null) return false;
  const scope = (row.treatment.treatmentScope ?? 'SINGLE') as TreatmentScope;
  return scope === 'SINGLE' && treatmentTeeth(row.treatment).length > 1;
}

/** Payload to remove a single tooth from a multi-tooth treatment (amounts pro-rated). */
export function buildPartialToothRemovalPayload(row: TreatmentDisplayRow) {
  const remainingTeeth = treatmentTeeth(row.treatment).filter((t) => t !== row.tooth);
  const discountCents = Math.max(0, row.treatment.discountCents - row.discountCents);
  return {
    teeth: remainingTeeth,
    discount: discountCents / 100,
  };
}
