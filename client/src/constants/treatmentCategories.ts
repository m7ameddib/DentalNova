/** Mirrors server/src/common/treatment-catalog.constants.ts */
export const TREATMENT_CATEGORY_ORDER = [
  'DIAGNOSTIC',
  'PREVENTIVE',
  'RESTORATIVE',
  'ENDODONTIC',
  'PERIODONTAL',
  'SURGICAL',
  'PROSTHODONTIC',
  'COSMETIC',
  'IMPLANT',
  'ORTHODONTIC',
  'PEDIATRIC',
  'OCCLUSION',
] as const;

export type TreatmentCategory = (typeof TREATMENT_CATEGORY_ORDER)[number];

export const TREATMENT_CATEGORY_COLORS: Record<TreatmentCategory, string> = {
  DIAGNOSTIC: '#6366F1',
  PREVENTIVE: '#059669',
  RESTORATIVE: '#2563EB',
  ENDODONTIC: '#DC2626',
  PERIODONTAL: '#0D9488',
  SURGICAL: '#111827',
  PROSTHODONTIC: '#D97706',
  COSMETIC: '#0EA5E9',
  IMPLANT: '#7C3AED',
  ORTHODONTIC: '#65A30D',
  PEDIATRIC: '#F59E0B',
  OCCLUSION: '#BE185D',
};
