/**
 * ZoliQua React-Odontogram-Modul measured anatomy — template mapping & column widths.
 * @see https://github.com/ZoliQua/React-Odontogram-Modul
 * @see tools/toothgen/spec.py (col_px)
 * @see src/odontogram.ts (MEASURED_TOOTH_TEMPLATE)
 */
import svg11 from './zoliqua-teeth/11.svg?raw';
import svg12 from './zoliqua-teeth/12.svg?raw';
import svg13 from './zoliqua-teeth/13.svg?raw';
import svg14 from './zoliqua-teeth/14.svg?raw';
import svg15 from './zoliqua-teeth/15.svg?raw';
import svg16 from './zoliqua-teeth/16.svg?raw';
import svg17 from './zoliqua-teeth/17.svg?raw';
import svg31 from './zoliqua-teeth/31.svg?raw';
import svg46 from './zoliqua-teeth/46.svg?raw';
import { getToothAnatomyType } from '@/utils/teeth';
import type { ToothAnatomyKind } from './types';

export type ZoliquaTemplateId = 11 | 12 | 13 | 14 | 15 | 16 | 17 | 31 | 46;

export interface ZoliquaToothPlacement {
  tpl: ZoliquaTemplateId;
  rot: 0 | 180;
  mirror: boolean;
}

/** Original measured SVG template text keyed by template id. */
export const ZOLIQUA_TEMPLATE_SVG: Record<ZoliquaTemplateId, string> = {
  11: svg11,
  12: svg12,
  13: svg13,
  14: svg14,
  15: svg15,
  16: svg16,
  17: svg17,
  31: svg31,
  46: svg46,
};

/** Grid column width (px) per template — from spec.py `col_px`. */
export const ZOLIQUA_COL_PX: Record<ZoliquaTemplateId, number> = {
  11: 62,
  12: 49,
  31: 40,
  13: 54,
  14: 52,
  15: 51,
  16: 72,
  17: 63,
  46: 75,
};

/** Uniform display scale — preserves per-tooth aspect ratio from templates. */
export const ZOLIQUA_WIDTH_SCALE = 0.78;

/** A5 print — fits 32 teeth across ~130 mm printable width. */
export const ZOLIQUA_PRINT_WIDTH_SCALE = 0.48;

/** Lower incisors (31, 32, 41, 42) — slightly larger display without changing SVG. */
const LOWER_INCISOR_DISPLAY_BOOST = 1.18;

const LOWER_INCISORS = new Set([31, 32, 41, 42]);

/**
 * FDI tooth → template placement (rotate / mirror) — mirrors ZoliQua MEASURED_TOOTH_TEMPLATE.
 * Upper: roots up / crowns down. Lower: rot 180. Left quadrants: mirror Y (vertical flip).
 */
export const ZOLIQUA_TOOTH_PLACEMENT = new Map<number, ZoliquaToothPlacement>([
  [11, { tpl: 11, rot: 0, mirror: false }],
  [21, { tpl: 11, rot: 0, mirror: true }],
  [12, { tpl: 12, rot: 0, mirror: false }],
  [22, { tpl: 12, rot: 0, mirror: true }],
  [31, { tpl: 31, rot: 180, mirror: false }],
  [32, { tpl: 31, rot: 180, mirror: false }],
  [41, { tpl: 31, rot: 180, mirror: true }],
  [42, { tpl: 31, rot: 180, mirror: true }],
  [13, { tpl: 13, rot: 0, mirror: false }],
  [23, { tpl: 13, rot: 0, mirror: true }],
  [33, { tpl: 13, rot: 180, mirror: false }],
  [43, { tpl: 13, rot: 180, mirror: true }],
  [14, { tpl: 14, rot: 0, mirror: false }],
  [24, { tpl: 14, rot: 0, mirror: true }],
  [15, { tpl: 15, rot: 0, mirror: false }],
  [25, { tpl: 15, rot: 0, mirror: true }],
  [34, { tpl: 15, rot: 180, mirror: false }],
  [35, { tpl: 15, rot: 180, mirror: false }],
  [44, { tpl: 15, rot: 180, mirror: true }],
  [45, { tpl: 15, rot: 180, mirror: true }],
  [16, { tpl: 16, rot: 0, mirror: false }],
  [26, { tpl: 16, rot: 0, mirror: true }],
  [17, { tpl: 17, rot: 0, mirror: false }],
  [18, { tpl: 17, rot: 0, mirror: false }],
  [27, { tpl: 17, rot: 0, mirror: true }],
  [28, { tpl: 17, rot: 0, mirror: true }],
  [36, { tpl: 46, rot: 180, mirror: false }],
  [37, { tpl: 46, rot: 180, mirror: false }],
  [38, { tpl: 46, rot: 180, mirror: false }],
  [46, { tpl: 46, rot: 180, mirror: true }],
  [47, { tpl: 46, rot: 180, mirror: true }],
  [48, { tpl: 46, rot: 180, mirror: true }],
]);

export interface ZoliquaToothMeta {
  placement: ZoliquaToothPlacement;
  kind: ToothAnatomyKind;
  cellWidth: number;
  aspectRatio: number;
}

const aspectCache = new Map<ZoliquaTemplateId, number>();

function templateAspectRatio(tpl: ZoliquaTemplateId): number {
  if (aspectCache.has(tpl)) return aspectCache.get(tpl)!;
  const raw = ZOLIQUA_TEMPLATE_SVG[tpl];
  const match = raw.match(/viewBox="[^"]*\s+([\d.]+)\s+([\d.]+)"/);
  const w = match ? Number(match[1]) : 40;
  const h = match ? Number(match[2]) : 80;
  const ratio = h / w;
  aspectCache.set(tpl, ratio);
  return ratio;
}

export function getZoliquaToothMeta(toothNumber: number, print = false): ZoliquaToothMeta {
  const placement = ZOLIQUA_TOOTH_PLACEMENT.get(toothNumber) ?? { tpl: 16 as ZoliquaTemplateId, rot: 0, mirror: false };
  const colPx = ZOLIQUA_COL_PX[placement.tpl];
  const baseScale = print ? ZOLIQUA_PRINT_WIDTH_SCALE : ZOLIQUA_WIDTH_SCALE;
  let cellWidth = Math.round((colPx - 6) * baseScale);
  if (LOWER_INCISORS.has(toothNumber)) {
    cellWidth = Math.round(cellWidth * LOWER_INCISOR_DISPLAY_BOOST);
  }
  return {
    placement,
    kind: getToothAnatomyType(toothNumber) as ToothAnatomyKind,
    cellWidth,
    aspectRatio: templateAspectRatio(placement.tpl),
  };
}

export function getCellWidth(toothNumber: number, print = false): number {
  return getZoliquaToothMeta(toothNumber, print).cellWidth;
}

/** Tallest side-view tooth height at current scale — aligns occlusal plane per arch. */
const graphicSlotHeightCache = new Map<boolean, number>();

export function getGraphicSlotHeight(print = false): number {
  if (graphicSlotHeightCache.has(print)) return graphicSlotHeightCache.get(print)!;
  let max = 0;
  const baseScale = print ? ZOLIQUA_PRINT_WIDTH_SCALE : ZOLIQUA_WIDTH_SCALE;
  for (const tpl of Object.keys(ZOLIQUA_COL_PX).map(Number) as ZoliquaTemplateId[]) {
    let w = Math.round((ZOLIQUA_COL_PX[tpl] - 6) * baseScale);
    if (tpl === 31) w = Math.round(w * LOWER_INCISOR_DISPLAY_BOOST);
    max = Math.max(max, Math.round(w * templateAspectRatio(tpl)));
  }
  graphicSlotHeightCache.set(print, max);
  return max;
}
