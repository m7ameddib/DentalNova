import { getToothAnatomyType } from '@/utils/teeth';
import {
  getCellWidth,
  getZoliquaToothMeta,
  type ZoliquaToothMeta,
} from './zoliqua-teeth-data';
import type { ToothAnatomyKind } from './types';

export type { ZoliquaToothMeta };

export function getToothMeta(toothNumber: number): ZoliquaToothMeta {
  return getZoliquaToothMeta(toothNumber);
}

export function getAnatomyKind(toothNumber: number): ToothAnatomyKind {
  return getToothAnatomyType(toothNumber) as ToothAnatomyKind;
}

export { getCellWidth };

/** @deprecated Use getCellWidth(toothNumber) for per-tooth anatomical widths. */
export const CELL_WIDTH: Record<ToothAnatomyKind, number> = {
  incisor: 36,
  canine: 40,
  premolar: 48,
  molar: 60,
};
