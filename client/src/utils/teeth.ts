/**
 * Permanent adult teeth numbering (FDI notation), grouped into the four
 * clinical quadrants as required by the approved Patient Record layout.
 */
export const QUADRANTS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
} as const;

export type QuadrantKey = keyof typeof QUADRANTS;

export const ALL_TEETH: number[] = [
  ...QUADRANTS.upperRight,
  ...QUADRANTS.upperLeft,
  ...QUADRANTS.lowerRight,
  ...QUADRANTS.lowerLeft,
];

export type TreatmentScope = 'SINGLE' | 'UPPER_JAW' | 'LOWER_JAW' | 'ALL_TEETH';

/** Upper jaw FDI teeth (quadrants 1 & 2). */
export const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];

/** Lower jaw FDI teeth (quadrants 3 & 4). */
export const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export function teethForScope(scope: TreatmentScope): number[] {
  switch (scope) {
    case 'UPPER_JAW':
      return [...UPPER_TEETH];
    case 'LOWER_JAW':
      return [...LOWER_TEETH];
    case 'ALL_TEETH':
      return [...UPPER_TEETH, ...LOWER_TEETH];
    default:
      return [];
  }
}

/** Jaw-wide and full-mouth treatments are billed once, not per tooth. */
export function priceMultiplier(scope: TreatmentScope, teethCount: number): number {
  if (scope === 'UPPER_JAW' || scope === 'LOWER_JAW' || scope === 'ALL_TEETH') return 1;
  return Math.max(1, teethCount);
}

export function resolveScope(
  explicit: TreatmentScope | undefined | null,
  typeScope: TreatmentScope | undefined | null,
): TreatmentScope {
  return explicit ?? typeScope ?? 'SINGLE';
}

export function isJawScope(scope: TreatmentScope): boolean {
  return scope === 'UPPER_JAW' || scope === 'LOWER_JAW' || scope === 'ALL_TEETH';
}

export type ToothAnatomyType = 'incisor' | 'canine' | 'premolar' | 'molar';

/** FDI permanent tooth position → anatomical crown shape. */
export function getToothAnatomyType(number: number): ToothAnatomyType {
  const pos = number % 10;
  if (pos <= 2) return 'incisor';
  if (pos === 3) return 'canine';
  if (pos <= 5) return 'premolar';
  return 'molar';
}

/** FDI quadrants 3 & 4 are the lower arch. */
export function isLowerTooth(number: number): boolean {
  const quadrant = Math.floor(number / 10);
  return quadrant === 3 || quadrant === 4;
}
