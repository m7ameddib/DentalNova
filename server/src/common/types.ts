// Domain types shared across modules. Kept plain (no ORM decorators) since
// persistence uses raw SQL — this is the "domain model" layer sitting
// between repositories (data access) and services (business logic).

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type SyncStatus = 'LOCAL' | 'PENDING' | 'SYNCED';
export type AppointmentStatus = 'SCHEDULED' | 'WAITING' | 'IN_TREATMENT' | 'COMPLETED' | 'CANCELLED';
export type TreatmentStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VOID';
// Payment methods are data-driven (see `payment_methods` table / Settings),
// so this is a free-form code (e.g. "CASH") rather than a fixed union.
export type PaymentMethod = string;
export type AttachmentCategory = 'XRAY' | 'PHOTO' | 'DOCUMENT' | 'OTHER';
export type ExpenseCategory = 'MATERIALS' | 'LAB' | 'RENT' | 'UTILITIES' | 'MAINTENANCE' | 'OTHER';

export interface Role {
  id: number;
  name: string;
  label: string;
  isSystem: boolean;
  createdAt: string;
}

export interface Permission {
  id: number;
  key: string;
  label: string;
}

export interface User {
  id: number;
  fullName: string;
  username: string;
  passwordHash: string;
  phone: string | null;
  phoneNormalized: string | null;
  roleId: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithRole extends Omit<User, 'passwordHash'> {
  roleName: string;
  roleLabel: string;
  permissions: string[];
}

export interface FamilyGroup {
  id: number;
  contactPhone: string | null;
  label: string | null;
  createdAt: string;
}

export interface Patient {
  id: number;
  fileNumber: string;
  fullName: string;
  phone: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  approxAge: number | null;
  weightKg: number | null;
  address: string | null;
  areaId: number | null;
  medicalNotes: string | null;
  generalNotes: string | null;
  familyGroupId: number | null;
  guarantorId: number | null;
  accountDiscountCents?: number;
  archivedAt: string | null;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: number;
  patientId: number | null;
  guestName: string | null;
  guestPhone: string | null;
  date: string;
  time: string;
  durationMin: number;
  appointmentType: string;
  reason: string | null;
  status: AppointmentStatus;
  notes: string | null;
  reminderSentAt: string | null;
  createdById: number | null;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentType {
  id: number;
  code: string;
  abbreviation: string;
  label: string;
  colorHex: string;
  isActive: boolean;
  sortOrder: number;
  defaultPriceCents: number;
  /** @deprecated Legacy single follow-up — use followUp1Days..3 */
  followUpDays: number | null;
  followUp1Days: number | null;
  followUp2Days: number | null;
  followUp3Days: number | null;
  category: string | null;
  referencePriceCents: number | null;
  scope: string | null;
}

export interface PatientTreatment {
  id: number;
  patientId: number;
  treatmentTypeId: number;
  toothNumber: number | null;
  priceCents: number;
  baseAmountCents: number;
  discountCents: number;
  finalAmountCents: number;
  status: TreatmentStatus;
  note: string | null;
  doctorId: number | null;
  completedAt: string | null;
  completedById: number | null;
  followUp1Days: number | null;
  followUp2Days: number | null;
  followUp3Days: number | null;
  treatmentDate: string | null;
  treatmentScope: string | null;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PatientTreatmentTooth {
  id: number;
  treatmentId: number;
  toothNumber: number;
}

export type PaymentStatus = 'ACTIVE' | 'VOID';

export interface AccountDiscount {
  id: number;
  patientId: number;
  amountCents: number;
  date: string;
  note: string | null;
  recordedById: number | null;
  status: PaymentStatus;
  voidedAt: string | null;
  voidedById: number | null;
  voidReason: string | null;
  voidedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: number;
  patientId: number;
  amountCents: number;
  method: PaymentMethod;
  methodLabel?: string;
  date: string;
  note: string | null;
  recordedById: number | null;
  status: PaymentStatus;
  voidedAt: string | null;
  voidedById: number | null;
  voidReason: string | null;
  voidedByName?: string | null;
  syncStatus: SyncStatus;
  createdAt: string;
}

export interface PaymentMethodEntity {
  id: number;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Area {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiseaseCatalogItem {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicSettings {
  id: number;
  clinicName: string | null;
  clinicPhone: string | null;
  doctorPhone: string | null;
  address: string | null;
  logoPath: string | null;
  logoOriginalName: string | null;
  workingDays: string; // CSV of 0-6 (0=Sunday)
  workStartTime: string;
  workEndTime: string;
  whatsappMessageLanguage: string;
  whatsappAppointmentReminderEn: string | null;
  whatsappAppointmentReminderAr: string | null;
  whatsappClinicalFollowupEn: string | null;
  whatsappClinicalFollowupAr: string | null;
  whatsappFinancialFollowupEn: string | null;
  whatsappFinancialFollowupAr: string | null;
  doctorNameAr: string | null;
  doctorNameEn: string | null;
  doctorTitleAr: string | null;
  doctorTitleEn: string | null;
  doctorLicenseNo: string | null;
  updatedAt: string;
}

export interface ClinicExpense {
  id: number;
  date: string;
  amountCents: number;
  category: ExpenseCategory | string;
  expenseCategoryId: number | null;
  paymentMethod: string;
  paidTo: string | null;
  note: string | null;
  createdById: number | null;
  status?: string;
  voidedAt?: string | null;
  voidedById?: number | null;
  voidReason?: string | null;
  sourceLabPaymentId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type MedicationCategory = 'ANTIBIOTICS' | 'PAINKILLERS' | 'ANTI_INFLAMMATORY' | 'MOUTHWASH' | 'OTHER';

export interface MedicationCatalogItem {
  id: number;
  name: string;
  strengthForm: string | null;
  category: MedicationCategory | string;
  defaultDose: string | null;
  defaultFrequency: string | null;
  defaultDuration: string | null;
  defaultInstructions: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export type PrescriptionType = 'MEDICATION' | 'XRAY';

export interface Prescription {
  id: number;
  patientId: number;
  doctorId: number | null;
  type: PrescriptionType;
  createdAt: string;
}

export interface PrescriptionItem {
  id: number;
  prescriptionId: number;
  medicineName: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  sortOrder: number;
}

export interface PrescriptionWithItems extends Prescription {
  doctorName: string | null;
  items: PrescriptionItem[];
}

export interface PatientAttachment {
  id: number;
  patientId: number;
  originalFileName: string;
  category: AttachmentCategory;
  storedPath: string;
  mimeType: string | null;
  fileSize: number | null;
  note: string | null;
  uploadedById: number | null;
  patientTreatmentId: number | null;
  clinicalVisitNoteId: number | null;
  teeth: number[];
  treatmentLabel?: string | null;
  visitDate?: string | null;
  createdAt: string;
}

export interface MedicalAlert {
  id: number;
  patientId: number;
  alertType: string;
  label: string;
  note: string | null;
  diseaseCatalogId: number | null;
  isActive: boolean;
  createdById: number | null;
  createdByName?: string | null;
  deactivatedAt: string | null;
  deactivatedById: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalVisitNote {
  id: number;
  patientId: number;
  visitDate: string;
  chiefComplaint: string | null;
  examinationFindings: string | null;
  diagnosis: string | null;
  procedureAction: string | null;
  anesthesiaNote: string | null;
  clinicalNotes: string | null;
  patientInstructions: string | null;
  createdById: number | null;
  createdByName?: string | null;
  updatedById: number | null;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entityType: string | null;
  entityId: number | null;
  patientId: number | null;
  patientName?: string | null;
  description: string;
  userId: number | null;
  userName?: string | null;
  createdAt: string;
}

export type FollowUpType = 'CLINICAL' | 'FINANCIAL';
export type FollowUpStoredStatus = 'ACTIVE' | 'COMPLETED';
/** Computed display status derived from follow_up_date vs today. */
export type FollowUpDisplayStatus = 'UPCOMING' | 'TODAY' | 'OVERDUE' | 'COMPLETED';
export type FollowUpResult =
  | 'FINE'
  | 'PAIN'
  | 'SWELLING'
  | 'NEEDS_APPOINTMENT'
  | 'NO_ANSWER'
  | 'FOLLOWED_UP'
  | 'PAID'
  | 'CUSTOM'
  | 'REMINDER_SENT'
  | 'PROMISED_PAYMENT'
  | 'PAID_INSTALLMENT'
  | 'SETTLED';

export interface FollowUp {
  id: number;
  patientId: number;
  type: FollowUpType;
  status: FollowUpStoredStatus;
  reason: string;
  followUpDate: string;
  details: string | null;
  note: string | null;
  patientTreatmentId: number | null;
  createdById: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpWithPatient extends FollowUp {
  patientName: string;
  patientFileNumber: string;
  patientPhone: string;
  displayStatus: FollowUpDisplayStatus;
  /** Financial only — computed from live account data, not stored. */
  remainingCents?: number;
  totalCostCents?: number;
  totalPaidCents?: number;
  lastPaymentDate?: string | null;
  lastPaymentAmountCents?: number | null;
}

export interface FollowUpHistoryEntry {
  id: number;
  followUpId: number | null;
  patientId: number;
  type: FollowUpType;
  reason: string;
  result: FollowUpResult | null;
  note: string | null;
  nextFollowUpDate: string | null;
  appointmentId: number | null;
  appointmentSummary: string | null;
  paymentId: number | null;
  paymentAmountCents: number | null;
  performedById: number | null;
  createdAt: string;
  patientName?: string;
  performedByName?: string | null;
}

export type LabCaseStatus =
  | 'PENDING'
  | 'SENT_TO_LAB'
  | 'IN_PROGRESS'
  | 'RECEIVED_FROM_LAB'
  | 'DELIVERED_TO_PATIENT'
  | 'CANCELLED';

export type LabCaseDueAlert = 'DUE_TODAY' | 'DUE_TOMORROW' | 'OVERDUE' | null;

export interface LabWorkType {
  id: number;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface LabName {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface LabCase {
  id: number;
  patientId: number;
  patientTreatmentId: number | null;
  labName: string;
  workTypeCode: string;
  workTypeCustom: string | null;
  status: LabCaseStatus;
  labCostCents: number;
  sentDate: string | null;
  expectedDeliveryDate: string | null;
  receivedDate: string | null;
  deliveredDate: string | null;
  notes: string | null;
  createdById: number | null;
  createdAt: string;
  updatedAt: string;
}

export type LabPaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface LabCasePayment {
  id: number;
  labCaseId: number;
  amountCents: number;
  paymentMethod: string;
  paymentDate: string;
  note: string | null;
  expenseId: number | null;
  status: string;
  voidedAt: string | null;
  voidedById: number | null;
  voidReason: string | null;
  recordedById: number | null;
  recordedByName?: string | null;
  voidedByName?: string | null;
  createdAt: string;
}

export interface LabAccountPayment {
  id: number;
  labNameId: number;
  amountCents: number;
  paymentMethod: string;
  paymentDate: string;
  note: string | null;
  expenseId: number | null;
  status: string;
  voidedAt: string | null;
  voidedById: number | null;
  voidReason: string | null;
  recordedById: number | null;
  recordedByName?: string | null;
  voidedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabAccountSummary {
  labNameId: number;
  labName: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
}

export interface LabAccountPaymentRow {
  id: number;
  source: 'CASE' | 'LAB';
  labCaseId: number | null;
  amountCents: number;
  paymentMethod: string;
  paymentDate: string;
  note: string | null;
  status: string;
  voidReason: string | null;
  recordedByName: string | null;
  createdAt: string;
  patientName?: string | null;
  patientFileNumber?: string | null;
  workTypeLabel?: string | null;
  editable: boolean;
}

export interface LabStatementLine {
  date: string;
  description: string;
  debitCents: number;
  creditCents: number;
  balanceCents: number;
}

export interface LabCaseFinancialSummary {
  labCostCents: number;
  totalPaidCents: number;
  remainingLabBalanceCents: number;
  labPaymentStatus: LabPaymentStatus;
}

export interface LabCaseWithDetails extends LabCase {
  patientName: string;
  patientFileNumber: string;
  patientPhone: string;
  teeth: number[];
  workTypeLabel: string;
  treatmentLabel: string | null;
  treatmentTeeth: number[];
  dueAlert: LabCaseDueAlert;
  totalPaidCents?: number;
  remainingLabBalanceCents?: number;
  labPaymentStatus?: LabPaymentStatus;
  payments?: LabCasePayment[];
}

export interface LabCaseHistoryEntry {
  id: number;
  labCaseId: number;
  patientId: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  performedById: number | null;
  createdAt: string;
  performedByName?: string | null;
}
