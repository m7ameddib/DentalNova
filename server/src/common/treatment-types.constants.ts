/**
 * Extensible catalog of treatment types. Seeded into the treatment_types
 * table on first run; clinics can add more later (see Settings, future
 * phase) without any code change since the chart/UI reads from the DB.
 */
export const DEFAULT_TREATMENT_TYPES: {
  code: string;
  abbreviation: string;
  label: string;
  colorHex: string;
  sortOrder: number;
  defaultPriceCents: number;
}[] = [
  { code: 'FILLING', abbreviation: 'F', label: 'Filling', colorHex: '#2563EB', sortOrder: 1, defaultPriceCents: 5000 },
  { code: 'ROOT_CANAL', abbreviation: 'RCT', label: 'Root Canal', colorHex: '#DC2626', sortOrder: 2, defaultPriceCents: 30000 },
  { code: 'CROWN', abbreviation: 'CR', label: 'Crown', colorHex: '#D97706', sortOrder: 3, defaultPriceCents: 40000 },
  { code: 'EXTRACTION', abbreviation: 'EX', label: 'Extraction', colorHex: '#111827', sortOrder: 4, defaultPriceCents: 8000 },
  { code: 'CLEANING', abbreviation: 'CL', label: 'Cleaning', colorHex: '#059669', sortOrder: 5, defaultPriceCents: 3000 },
  { code: 'WHITENING', abbreviation: 'WH', label: 'Whitening', colorHex: '#0EA5E9', sortOrder: 6, defaultPriceCents: 15000 },
  { code: 'IMPLANT', abbreviation: 'IM', label: 'Implant', colorHex: '#7C3AED', sortOrder: 7, defaultPriceCents: 60000 },
  { code: 'BRIDGE', abbreviation: 'BR', label: 'Bridge', colorHex: '#BE185D', sortOrder: 8, defaultPriceCents: 45000 },
  { code: 'VENEER', abbreviation: 'VN', label: 'Veneer', colorHex: '#0891B2', sortOrder: 9, defaultPriceCents: 35000 },
  { code: 'ORTHODONTIC', abbreviation: 'ORTHO', label: 'Orthodontic', colorHex: '#65A30D', sortOrder: 10, defaultPriceCents: 200000 },
  { code: 'TEMP_FILLING', abbreviation: 'TF', label: 'Temporary Filling', colorHex: '#9333EA', sortOrder: 11, defaultPriceCents: 2000 },
  { code: 'OTHER', abbreviation: 'OTH', label: 'Other', colorHex: '#6B7280', sortOrder: 12, defaultPriceCents: 5000 },
];
