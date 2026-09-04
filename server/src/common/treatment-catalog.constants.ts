/**
 * Comprehensive dental treatment catalog — seeded idempotently (disabled by default).
 * Clinics enable treatments and set prices from Settings > Treatment Catalog.
 */

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

export interface ComprehensiveTreatmentEntry {
  code: string;
  abbreviation: string;
  label: string;
  category: TreatmentCategory;
}

/** Existing legacy codes mapped to categories (rows are never deleted). */
export const LEGACY_TREATMENT_CATEGORIES: Record<string, TreatmentCategory> = {
  FILLING: 'RESTORATIVE',
  ROOT_CANAL: 'ENDODONTIC',
  CROWN: 'PROSTHODONTIC',
  EXTRACTION: 'SURGICAL',
  CLEANING: 'PREVENTIVE',
  WHITENING: 'COSMETIC',
  IMPLANT: 'IMPLANT',
  BRIDGE: 'PROSTHODONTIC',
  VENEER: 'COSMETIC',
  ORTHODONTIC: 'ORTHODONTIC',
  TEMP_FILLING: 'RESTORATIVE',
  OTHER: 'DIAGNOSTIC',
};

export const COMPREHENSIVE_TREATMENT_CATALOG: ComprehensiveTreatmentEntry[] = [
  // Diagnostic
  { code: 'EXAM', abbreviation: 'EXAM', label: 'Dental Examination', category: 'DIAGNOSTIC' },
  { code: 'CONS', abbreviation: 'CONS', label: 'Consultation', category: 'DIAGNOSTIC' },
  { code: 'EMG_EXAM', abbreviation: 'EMG-EXAM', label: 'Emergency Examination', category: 'DIAGNOSTIC' },
  { code: 'TX_PLAN', abbreviation: 'TX-PLAN', label: 'Treatment Plan', category: 'DIAGNOSTIC' },
  { code: 'XRAY', abbreviation: 'XRAY', label: 'Dental X-Ray', category: 'DIAGNOSTIC' },
  { code: 'PA_XRAY', abbreviation: 'PA-XRAY', label: 'Periapical X-Ray', category: 'DIAGNOSTIC' },
  { code: 'BW_XRAY', abbreviation: 'BW-XRAY', label: 'Bitewing X-Ray', category: 'DIAGNOSTIC' },
  { code: 'OCC_XRAY', abbreviation: 'OCC-XRAY', label: 'Occlusal X-Ray', category: 'DIAGNOSTIC' },
  { code: 'FMX', abbreviation: 'FMX', label: 'Full Mouth X-Ray Series', category: 'DIAGNOSTIC' },
  // Preventive
  { code: 'SCAL', abbreviation: 'SCAL', label: 'Scaling', category: 'PREVENTIVE' },
  { code: 'POL', abbreviation: 'POL', label: 'Polishing', category: 'PREVENTIVE' },
  { code: 'FLU', abbreviation: 'FLU', label: 'Fluoride Treatment', category: 'PREVENTIVE' },
  { code: 'SEAL', abbreviation: 'SEAL', label: 'Fissure Sealant', category: 'PREVENTIVE' },
  { code: 'OHI', abbreviation: 'OHI', label: 'Oral Hygiene Instruction', category: 'PREVENTIVE' },
  { code: 'DES', abbreviation: 'DES', label: 'Desensitization', category: 'PREVENTIVE' },
  // Restorative
  { code: 'COMP1', abbreviation: 'COMP1', label: 'Composite Filling 1 Surface', category: 'RESTORATIVE' },
  { code: 'COMP2', abbreviation: 'COMP2', label: 'Composite Filling 2 Surfaces', category: 'RESTORATIVE' },
  { code: 'COMP3', abbreviation: 'COMP3', label: 'Composite Filling 3 Surfaces', category: 'RESTORATIVE' },
  { code: 'GIC', abbreviation: 'GIC', label: 'Glass Ionomer Filling', category: 'RESTORATIVE' },
  { code: 'TFILL', abbreviation: 'TFILL', label: 'Temporary Filling', category: 'RESTORATIVE' },
  { code: 'TEMP_REST', abbreviation: 'TEMP-REST', label: 'Temporary Restoration', category: 'RESTORATIVE' },
  { code: 'CORE', abbreviation: 'CORE', label: 'Core Build-Up', category: 'RESTORATIVE' },
  { code: 'AMAL', abbreviation: 'AMAL', label: 'Amalgam Filling', category: 'RESTORATIVE' },
  // Endodontic
  { code: 'RCT_A', abbreviation: 'RCT-A', label: 'Root Canal Anterior', category: 'ENDODONTIC' },
  { code: 'RCT_P', abbreviation: 'RCT-P', label: 'Root Canal Premolar', category: 'ENDODONTIC' },
  { code: 'RCT_M', abbreviation: 'RCT-M', label: 'Root Canal Molar', category: 'ENDODONTIC' },
  { code: 'PULP', abbreviation: 'PULP', label: 'Pulpotomy', category: 'ENDODONTIC' },
  { code: 'PULP_E', abbreviation: 'PULP-E', label: 'Pulpectomy', category: 'ENDODONTIC' },
  { code: 'RCT_RET', abbreviation: 'RCT-RET', label: 'Root Canal Retreatment', category: 'ENDODONTIC' },
  { code: 'RCF1', abbreviation: 'RCF1', label: 'Root Canal Filling 1 Canal', category: 'ENDODONTIC' },
  { code: 'RCF2', abbreviation: 'RCF2', label: 'Root Canal Filling 2 Canals', category: 'ENDODONTIC' },
  { code: 'RCF3', abbreviation: 'RCF3', label: 'Root Canal Filling 3+ Canals', category: 'ENDODONTIC' },
  { code: 'APEXIF', abbreviation: 'APEXIF', label: 'Apexification', category: 'ENDODONTIC' },
  { code: 'APEX', abbreviation: 'APEX', label: 'Apicoectomy', category: 'ENDODONTIC' },
  // Periodontal
  { code: 'PERIO_EX', abbreviation: 'PERIO-EX', label: 'Periodontal Examination', category: 'PERIODONTAL' },
  { code: 'SRP', abbreviation: 'SRP', label: 'Scaling and Root Planing', category: 'PERIODONTAL' },
  { code: 'DEEP_SCAL', abbreviation: 'DEEP-SCAL', label: 'Deep Cleaning', category: 'PERIODONTAL' },
  { code: 'PERIO_M', abbreviation: 'PERIO-M', label: 'Periodontal Maintenance', category: 'PERIODONTAL' },
  { code: 'GING_TX', abbreviation: 'GING-TX', label: 'Gingival Treatment', category: 'PERIODONTAL' },
  { code: 'PERIO_SPL', abbreviation: 'PERIO-SPL', label: 'Periodontal Splint', category: 'PERIODONTAL' },
  { code: 'CROWN_L', abbreviation: 'CROWN-L', label: 'Crown Lengthening', category: 'PERIODONTAL' },
  // Surgical
  { code: 'EXT', abbreviation: 'EXT', label: 'Simple Extraction', category: 'SURGICAL' },
  { code: 'S_EXT', abbreviation: 'S-EXT', label: 'Surgical Extraction', category: 'SURGICAL' },
  { code: 'W_EXT', abbreviation: 'W-EXT', label: 'Wisdom Tooth Extraction', category: 'SURGICAL' },
  { code: 'IMP_EXT', abbreviation: 'IMP-EXT', label: 'Impacted Tooth Extraction', category: 'SURGICAL' },
  { code: 'ROOT_EXT', abbreviation: 'ROOT-EXT', label: 'Root Removal', category: 'SURGICAL' },
  { code: 'ALV', abbreviation: 'ALV', label: 'Alveoloplasty', category: 'SURGICAL' },
  { code: 'FREN', abbreviation: 'FREN', label: 'Frenectomy', category: 'SURGICAL' },
  { code: 'I_AND_D', abbreviation: 'I&D', label: 'Incision and Drainage', category: 'SURGICAL' },
  { code: 'BIOP', abbreviation: 'BIOP', label: 'Biopsy', category: 'SURGICAL' },
  // Prosthodontic
  { code: 'TC', abbreviation: 'TC', label: 'Temporary Crown', category: 'PROSTHODONTIC' },
  { code: 'MC', abbreviation: 'MC', label: 'Metal Crown', category: 'PROSTHODONTIC' },
  { code: 'PFM', abbreviation: 'PFM', label: 'PFM Crown', category: 'PROSTHODONTIC' },
  { code: 'ZIR', abbreviation: 'ZIR', label: 'Zirconia Crown', category: 'PROSTHODONTIC' },
  { code: 'EMAX', abbreviation: 'EMAX', label: 'E.max Crown', category: 'PROSTHODONTIC' },
  { code: 'CPC', abbreviation: 'CPC', label: 'Cast Post and Core', category: 'PROSTHODONTIC' },
  { code: 'FPOST', abbreviation: 'FPOST', label: 'Fiber Post', category: 'PROSTHODONTIC' },
  { code: 'CVEN', abbreviation: 'CVEN', label: 'Composite Veneer', category: 'PROSTHODONTIC' },
  { code: 'PVEN', abbreviation: 'PVEN', label: 'Ceramic Veneer', category: 'PROSTHODONTIC' },
  { code: 'FD_U', abbreviation: 'FD-U', label: 'Full Denture Upper', category: 'PROSTHODONTIC' },
  { code: 'FD_L', abbreviation: 'FD-L', label: 'Full Denture Lower', category: 'PROSTHODONTIC' },
  { code: 'FD', abbreviation: 'FD', label: 'Complete Denture', category: 'PROSTHODONTIC' },
  { code: 'APD', abbreviation: 'APD', label: 'Acrylic Partial Denture', category: 'PROSTHODONTIC' },
  { code: 'MPD', abbreviation: 'MPD', label: 'Metal Partial Denture', category: 'PROSTHODONTIC' },
  { code: 'D_REP', abbreviation: 'D-REP', label: 'Denture Repair', category: 'PROSTHODONTIC' },
  { code: 'RELINE', abbreviation: 'RELINE', label: 'Denture Relining', category: 'PROSTHODONTIC' },
  { code: 'RECEM', abbreviation: 'RECEM', label: 'Crown Recementation', category: 'PROSTHODONTIC' },
  { code: 'BRIDGE', abbreviation: 'BRIDGE', label: 'Bridge', category: 'PROSTHODONTIC' },
  { code: 'BR_UNIT', abbreviation: 'BR-UNIT', label: 'Bridge Unit', category: 'PROSTHODONTIC' },
  // Cosmetic
  { code: 'CVEN_COS', abbreviation: 'CVEN', label: 'Composite Veneer', category: 'COSMETIC' },
  { code: 'PVEN_COS', abbreviation: 'PVEN', label: 'Ceramic Veneer', category: 'COSMETIC' },
  { code: 'WHIT', abbreviation: 'WHIT', label: 'Teeth Whitening', category: 'COSMETIC' },
  { code: 'WH_H', abbreviation: 'WH-H', label: 'Home Whitening', category: 'COSMETIC' },
  { code: 'WH_O', abbreviation: 'WH-O', label: 'In-Office Whitening', category: 'COSMETIC' },
  { code: 'BLEACH', abbreviation: 'BLEACH', label: 'Tooth Bleaching', category: 'COSMETIC' },
  { code: 'SMILE', abbreviation: 'SMILE', label: 'Smile Design', category: 'COSMETIC' },
  // Implant
  { code: 'IMP', abbreviation: 'IMP', label: 'Dental Implant Placement', category: 'IMPLANT' },
  { code: 'ABUT', abbreviation: 'ABUT', label: 'Implant Abutment', category: 'IMPLANT' },
  { code: 'IMP_C', abbreviation: 'IMP-C', label: 'Implant Crown', category: 'IMPLANT' },
  { code: 'IMP_EX', abbreviation: 'IMP-EX', label: 'Implant Consultation', category: 'IMPLANT' },
  { code: 'IMP_R', abbreviation: 'IMP-R', label: 'Implant Restoration', category: 'IMPLANT' },
  { code: 'B_GRAFT', abbreviation: 'B-GRAFT', label: 'Bone Graft', category: 'IMPLANT' },
  { code: 'SINUS', abbreviation: 'SINUS', label: 'Sinus Lift', category: 'IMPLANT' },
  { code: 'IMP_M', abbreviation: 'IMP-M', label: 'Implant Maintenance', category: 'IMPLANT' },
  // Orthodontic
  { code: 'ORTH_EX', abbreviation: 'ORTH-EX', label: 'Orthodontic Consultation', category: 'ORTHODONTIC' },
  { code: 'ORTH_TX', abbreviation: 'ORTH-TX', label: 'Orthodontic Treatment', category: 'ORTHODONTIC' },
  { code: 'BR_U', abbreviation: 'BR-U', label: 'Fixed Braces Upper', category: 'ORTHODONTIC' },
  { code: 'BR_L', abbreviation: 'BR-L', label: 'Fixed Braces Lower', category: 'ORTHODONTIC' },
  { code: 'BR_FULL', abbreviation: 'BR-FULL', label: 'Fixed Braces Full', category: 'ORTHODONTIC' },
  { code: 'ORTH_ADJ', abbreviation: 'ORTH-ADJ', label: 'Orthodontic Adjustment', category: 'ORTHODONTIC' },
  { code: 'RET_U', abbreviation: 'RET-U', label: 'Retainer Upper', category: 'ORTHODONTIC' },
  { code: 'RET_L', abbreviation: 'RET-L', label: 'Retainer Lower', category: 'ORTHODONTIC' },
  { code: 'REM_ORTH', abbreviation: 'REM-ORTH', label: 'Removable Appliance', category: 'ORTHODONTIC' },
  { code: 'SPACE_M', abbreviation: 'SPACE-M', label: 'Space Maintainer', category: 'ORTHODONTIC' },
  // Pediatric
  { code: 'PED_EX', abbreviation: 'PED-EX', label: 'Pediatric Examination', category: 'PEDIATRIC' },
  { code: 'PED_SCAL', abbreviation: 'PED-SCAL', label: 'Pediatric Cleaning', category: 'PEDIATRIC' },
  { code: 'PED_FILL', abbreviation: 'PED-FILL', label: 'Pediatric Filling', category: 'PEDIATRIC' },
  { code: 'PED_SEAL', abbreviation: 'PED-SEAL', label: 'Pediatric Sealant', category: 'PEDIATRIC' },
  { code: 'PED_FLU', abbreviation: 'PED-FLU', label: 'Pediatric Fluoride', category: 'PEDIATRIC' },
  { code: 'PED_EXT', abbreviation: 'PED-EXT', label: 'Primary Tooth Extraction', category: 'PEDIATRIC' },
  { code: 'PED_PULP', abbreviation: 'PED-PULP', label: 'Primary Tooth Pulpotomy', category: 'PEDIATRIC' },
  { code: 'PED_PULP_E', abbreviation: 'PED-PULP-E', label: 'Primary Tooth Pulpectomy', category: 'PEDIATRIC' },
  { code: 'PED_CROWN', abbreviation: 'PED-CROWN', label: 'Pediatric Crown', category: 'PEDIATRIC' },
  { code: 'PED_SPACE', abbreviation: 'PED-SPACE', label: 'Space Maintainer', category: 'PEDIATRIC' },
  // Occlusion / TMJ
  { code: 'NG', abbreviation: 'NG', label: 'Night Guard', category: 'OCCLUSION' },
  { code: 'OCC_SPL', abbreviation: 'OCC-SPL', label: 'Occlusal Splint', category: 'OCCLUSION' },
  { code: 'TMJ_EX', abbreviation: 'TMJ-EX', label: 'TMJ Examination', category: 'OCCLUSION' },
  { code: 'TMJ_SPL', abbreviation: 'TMJ-SPL', label: 'TMJ Splint', category: 'OCCLUSION' },
  { code: 'OCC_ADJ', abbreviation: 'OCC-ADJ', label: 'Occlusal Adjustment', category: 'OCCLUSION' },
];
