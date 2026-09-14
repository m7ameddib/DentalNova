export type SyncOp = 'upsert' | 'delete' | 'void';
export type ConflictPolicy = 'review' | 'lww-safe' | 'immutable';

export interface SyncEntityDef {
  name: string;
  table: string;
  fks: Record<string, string>;
  conflict: ConflictPolicy;
  skipColumns?: string[];
}

/** Parent → child order for apply. Reverse for capture grouping. */
export const SYNC_ENTITIES: SyncEntityDef[] = [
  { name: 'areas', table: 'areas', fks: {}, conflict: 'lww-safe' },
  { name: 'payment_methods', table: 'payment_methods', fks: {}, conflict: 'lww-safe' },
  { name: 'expense_categories', table: 'expense_categories', fks: {}, conflict: 'lww-safe' },
  { name: 'treatment_types', table: 'treatment_types', fks: {}, conflict: 'lww-safe' },
  { name: 'lab_names', table: 'lab_names', fks: {}, conflict: 'lww-safe' },
  { name: 'guarantors', table: 'guarantors', fks: {}, conflict: 'lww-safe' },
  { name: 'disease_catalog', table: 'disease_catalog', fks: {}, conflict: 'lww-safe' },
  { name: 'medication_catalog', table: 'medication_catalog', fks: {}, conflict: 'lww-safe' },
  { name: 'users', table: 'users', fks: {}, conflict: 'review', skipColumns: ['password_hash'] },
  { name: 'family_groups', table: 'family_groups', fks: {}, conflict: 'lww-safe' },
  {
    name: 'patients',
    table: 'patients',
    fks: { family_group_id: 'family_groups', area_id: 'areas', guarantor_id: 'guarantors' },
    conflict: 'review',
  },
  { name: 'appointments', table: 'appointments', fks: { patient_id: 'patients', created_by_id: 'users' }, conflict: 'review' },
  { name: 'appointment_walkins', table: 'appointment_walkins', fks: { appointment_id: 'appointments' }, conflict: 'review' },
  {
    name: 'patient_treatments',
    table: 'patient_treatments',
    fks: { patient_id: 'patients', treatment_type_id: 'treatment_types', doctor_id: 'users' },
    conflict: 'review',
  },
  { name: 'patient_treatment_teeth', table: 'patient_treatment_teeth', fks: { patient_treatment_id: 'patient_treatments' }, conflict: 'lww-safe' },
  { name: 'account_discounts', table: 'account_discounts', fks: { patient_id: 'patients' }, conflict: 'review' },
  {
    name: 'payments',
    table: 'payments',
    fks: { patient_id: 'patients', recorded_by_id: 'users', voided_by_id: 'users' },
    conflict: 'immutable',
  },
  { name: 'follow_ups', table: 'follow_ups', fks: { patient_id: 'patients', patient_treatment_id: 'patient_treatments' }, conflict: 'review' },
  {
    name: 'follow_up_history',
    table: 'follow_up_history',
    fks: { follow_up_id: 'follow_ups', patient_id: 'patients', payment_id: 'payments', performed_by_id: 'users' },
    conflict: 'immutable',
  },
  { name: 'lab_cases', table: 'lab_cases', fks: { patient_id: 'patients', laboratory_id: 'lab_names' }, conflict: 'review' },
  { name: 'lab_case_payments', table: 'lab_case_payments', fks: { lab_case_id: 'lab_cases' }, conflict: 'immutable' },
  { name: 'lab_account_payments', table: 'lab_account_payments', fks: { laboratory_id: 'lab_names' }, conflict: 'immutable' },
  {
    name: 'clinic_expenses',
    table: 'clinic_expenses',
    fks: { expense_category_id: 'expense_categories', created_by_id: 'users' },
    conflict: 'review',
  },
  { name: 'prescriptions', table: 'prescriptions', fks: { patient_id: 'patients' }, conflict: 'review' },
  { name: 'prescription_items', table: 'prescription_items', fks: { prescription_id: 'prescriptions' }, conflict: 'lww-safe' },
  { name: 'clinical_visit_notes', table: 'clinical_visit_notes', fks: { patient_id: 'patients' }, conflict: 'review' },
  { name: 'medical_alerts', table: 'medical_alerts', fks: { patient_id: 'patients' }, conflict: 'review' },
  {
    name: 'patient_attachments',
    table: 'patient_attachments',
    fks: {
      patient_id: 'patients',
      uploaded_by_id: 'users',
      patient_treatment_id: 'patient_treatments',
      clinical_visit_note_id: 'clinical_visit_notes',
    },
    conflict: 'review',
  },
];

export const SYNC_ENTITY_BY_NAME = Object.fromEntries(SYNC_ENTITIES.map((e) => [e.name, e]));

export function tableExists(db: { prepare: (sql: string) => { get: (name: string) => unknown } }, table: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(table);
  return Boolean(row);
}

export function newUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `uid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function newChangeId(): string {
  return newUid();
}

export function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function fkColumnToUidField(column: string): string {
  return `${snakeToCamel(column).replace(/Id$/, '')}Uid`;
}

export function paymentFingerprint(row: Record<string, unknown>): string {
  return [
    String(row.patientUid ?? ''),
    String(row.amountCents ?? ''),
    String(row.date ?? ''),
    String(row.method ?? ''),
    String(row.note ?? ''),
  ].join('|');
}

export interface SyncChangePayload {
  changeId: string;
  entity: string;
  recordUid: string;
  op: SyncOp;
  row?: Record<string, unknown> | null;
  updatedAt?: string | null;
}

export function rowsDiffer(a: Record<string, unknown>, b: Record<string, unknown>, skip: string[] = []): boolean {
  const ignore = new Set(['id', 'created_at', 'createdAt', 'updated_at', 'updatedAt', 'sync_status', 'syncStatus', ...skip]);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (ignore.has(key)) continue;
    if (JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)) return true;
  }
  return false;
}
