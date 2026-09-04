export interface ToothTreatmentBadge {
  abbreviation: string;
  colorHex: string;
  /** True when this treatment's status is COMPLETED — shows a ✓ next to the abbreviation. */
  completed?: boolean;
}

export interface OdontogramProps {
  toothMap: Map<number, ToothTreatmentBadge[]>;
  selectable: boolean;
  selectedTeeth: number[];
  onToggleTooth: (n: number) => void;
  /** Compact A5 print layout — smaller teeth, FDI only (no treatment tags). */
  printLayout?: boolean;
}

export type ToothAnatomyKind = 'incisor' | 'canine' | 'premolar' | 'molar';
