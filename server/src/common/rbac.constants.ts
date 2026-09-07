/**
 * Central catalog of permission keys used across the app.
 *
 * Roles and permissions are stored in the database (see database/migrations
 * and database/seed) so new roles can be introduced later without code
 * changes. This constant list is only the *known vocabulary* of actions the
 * backend enforces — it is what gets seeded for the initial two roles.
 */
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
  /** Financial Reports (financial summary, drill-downs, clinic expenses) — doctor only. */
  REPORTS_FINANCIAL_VIEW: 'reports.financial.view',

  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  USERS_MANAGE: 'users.manage',

  EXPENSES_MANAGE: 'expenses.manage',

  /** Prescriptions (create, view, print) — doctor only. */
  PRESCRIPTIONS_MANAGE: 'prescriptions.manage',

  /** Patient follow-ups (clinical + financial) — doctor and employee. */
  FOLLOWUPS_MANAGE: 'followups.manage',

  /** Dental lab cases — doctor and employee. */
  LAB_CASES_MANAGE: 'lab.cases.manage',

  /** Medical alerts on patient records. */
  MEDICAL_ALERTS_MANAGE: 'medical.alerts.manage',

  /** Clinical visit notes. */
  CLINICAL_NOTES_MANAGE: 'clinical.notes.manage',

  /** View activity audit log. */
  AUDIT_VIEW: 'audit.view',

  /** Void payments (soft void — keeps history). */
  PAYMENTS_VOID: 'payments.void',

  /** Book appointments outside configured working hours. */
  APPOINTMENTS_BOOK_OUTSIDE_HOURS: 'appointments.book_outside_hours',

  /** Use the AI Assistant (administrative + medical knowledge). */
  AI_ASSISTANT_USE: 'ai.assistant.use',

  /** Record payments to dental laboratories. */
  LAB_PAYMENTS_RECORD: 'lab.payments.record',

  /** Void lab case payments. */
  LAB_PAYMENTS_VOID: 'lab.payments.void',

  /** DibNova platform administration (subscriptions, licenses). */
  DIBNOVA_ADMIN: 'dibnova.admin',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: { key: string; label: string }[] = [
  { key: PERMISSIONS.PATIENTS_VIEW, label: 'View patients' },
  { key: PERMISSIONS.PATIENTS_CREATE, label: 'Create patients' },
  { key: PERMISSIONS.PATIENTS_EDIT, label: 'Edit patients' },
  { key: PERMISSIONS.PATIENTS_DELETE, label: 'Delete patients' },
  { key: PERMISSIONS.APPOINTMENTS_VIEW, label: 'View appointments' },
  { key: PERMISSIONS.APPOINTMENTS_CREATE, label: 'Create appointments' },
  { key: PERMISSIONS.APPOINTMENTS_EDIT, label: 'Edit appointments' },
  { key: PERMISSIONS.TREATMENTS_VIEW, label: 'View treatments' },
  { key: PERMISSIONS.TREATMENTS_CREATE, label: 'Create treatments' },
  { key: PERMISSIONS.TREATMENTS_MANAGE, label: 'Manage treatment catalog' },
  { key: PERMISSIONS.PAYMENTS_VIEW, label: 'View payments' },
  { key: PERMISSIONS.PAYMENTS_CREATE, label: 'Create payments' },
  { key: PERMISSIONS.REPORTS_VIEW, label: 'View reports' },
  { key: PERMISSIONS.REPORTS_FINANCIAL_VIEW, label: 'View financial reports' },
  { key: PERMISSIONS.SETTINGS_VIEW, label: 'View settings' },
  { key: PERMISSIONS.SETTINGS_MANAGE, label: 'Manage clinic settings' },
  { key: PERMISSIONS.USERS_MANAGE, label: 'Manage users' },
  { key: PERMISSIONS.EXPENSES_MANAGE, label: 'Manage clinic expenses' },
  { key: PERMISSIONS.PRESCRIPTIONS_MANAGE, label: 'Manage prescriptions' },
  { key: PERMISSIONS.FOLLOWUPS_MANAGE, label: 'Manage patient follow-ups' },
  { key: PERMISSIONS.LAB_CASES_MANAGE, label: 'Manage dental lab cases' },
  { key: PERMISSIONS.MEDICAL_ALERTS_MANAGE, label: 'Manage medical alerts' },
  { key: PERMISSIONS.CLINICAL_NOTES_MANAGE, label: 'Manage clinical visit notes' },
  { key: PERMISSIONS.AUDIT_VIEW, label: 'View activity audit log' },
  { key: PERMISSIONS.PAYMENTS_VOID, label: 'Void payments' },
  { key: PERMISSIONS.APPOINTMENTS_BOOK_OUTSIDE_HOURS, label: 'Book appointments outside working hours' },
  { key: PERMISSIONS.AI_ASSISTANT_USE, label: 'Use AI Assistant' },
  { key: PERMISSIONS.LAB_PAYMENTS_RECORD, label: 'Record lab case payments' },
  { key: PERMISSIONS.LAB_PAYMENTS_VOID, label: 'Void lab case payments' },
];

/** Initial roles. Extensible: more roles can be added later purely via data. */
export const DEFAULT_ROLES: {
  name: string;
  label: string;
  isSystem: boolean;
  permissions: string[];
}[] = [
  {
    name: 'doctor',
    label: 'Doctor',
    isSystem: true,
    permissions: ALL_PERMISSIONS.map((p) => p.key),
  },
  {
    name: 'employee',
    label: 'Employee',
    isSystem: true,
    permissions: [
      PERMISSIONS.PATIENTS_VIEW,
      PERMISSIONS.PATIENTS_CREATE,
      PERMISSIONS.PATIENTS_EDIT,
      PERMISSIONS.APPOINTMENTS_VIEW,
      PERMISSIONS.APPOINTMENTS_CREATE,
      PERMISSIONS.APPOINTMENTS_EDIT,
      PERMISSIONS.TREATMENTS_VIEW,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.PAYMENTS_CREATE,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.EXPENSES_MANAGE,
      PERMISSIONS.FOLLOWUPS_MANAGE,
      PERMISSIONS.LAB_CASES_MANAGE,
      PERMISSIONS.AI_ASSISTANT_USE,
    ],
  },
];
