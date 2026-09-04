// Mirrors server/src/common/rbac.constants.ts. Kept as plain string keys
// (not an exhaustive union) so new permissions/roles added server-side don't
// require a client rebuild to be respected — the UI simply checks whichever
// keys the logged-in user's token actually contains.
export const PERMISSIONS = {
  PATIENTS_VIEW: 'patients.view',
  PATIENTS_CREATE: 'patients.create',
  PATIENTS_EDIT: 'patients.edit',
  PATIENTS_DELETE: 'patients.delete',

  APPOINTMENTS_VIEW: 'appointments.view',
  APPOINTMENTS_CREATE: 'appointments.create',
  APPOINTMENTS_EDIT: 'appointments.edit',

  TREATMENTS_VIEW: 'treatments.view',
  TREATMENTS_CREATE: 'treatments.create',
  TREATMENTS_MANAGE: 'treatments.manage',

  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_CREATE: 'payments.create',

  REPORTS_VIEW: 'reports.view',
  REPORTS_FINANCIAL_VIEW: 'reports.financial.view',

  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  USERS_MANAGE: 'users.manage',

  EXPENSES_MANAGE: 'expenses.manage',

  PRESCRIPTIONS_MANAGE: 'prescriptions.manage',

  FOLLOWUPS_MANAGE: 'followups.manage',

  LAB_CASES_MANAGE: 'lab.cases.manage',

  MEDICAL_ALERTS_MANAGE: 'medical.alerts.manage',
  CLINICAL_NOTES_MANAGE: 'clinical.notes.manage',
  AUDIT_VIEW: 'audit.view',
  PAYMENTS_VOID: 'payments.void',

  APPOINTMENTS_BOOK_OUTSIDE_HOURS: 'appointments.book_outside_hours',
  LAB_PAYMENTS_RECORD: 'lab.payments.record',
  LAB_PAYMENTS_VOID: 'lab.payments.void',

  AI_ASSISTANT_USE: 'ai.assistant.use',
} as const;
