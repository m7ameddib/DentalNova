// Client-side mirror of the server domain types (see server/src/common/types.ts).
// Kept intentionally in sync by hand for this phase; API responses are typed
// against these shapes.

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type AppointmentStatus = 'SCHEDULED' | 'WAITING' | 'IN_TREATMENT' | 'COMPLETED' | 'CANCELLED';
export type TreatmentStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VOID';
// Payment methods are data-driven (see Settings > Payment Methods), so this is
// a free-form code (e.g. "CASH") rather than a fixed union.
export type PaymentMethod = string;
export type AttachmentCategory = 'XRAY' | 'PHOTO' | 'DOCUMENT' | 'OTHER';
export type ExpenseCategory = 'MATERIALS' | 'LAB' | 'RENT' | 'UTILITIES' | 'MAINTENANCE' | 'OTHER';

export interface AuthenticatedUser {
  id: number;
  fullName: string;
  username: string;
  isActive: boolean;
  roleId: number;
  roleName: string;
  roleLabel: string;
  permissions: string[];
}

export type TreatmentScope = 'SINGLE' | 'UPPER_JAW' | 'LOWER_JAW' | 'ALL_TEETH';

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
  guarantorId: number | null;
  accountDiscountCents?: number;
  medicalNotes: string | null;
  generalNotes: string | null;
  familyGroupId: number | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientDetail extends Patient {
  familyMembers: Patient[];
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
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentWithPatient extends Appointment {
  patientName: string;
  patientFileNumber: string | null;
  /** Linked patient's phone (null for walk-ins — use `guestPhone` instead). */
  patientPhone: string | null;
  /** Set when the appointment falls outside configured clinic hours. */
  outsideWorkingHours?: boolean;
}

export interface DaySchedule {
  date: string;
  isWorkingDay: boolean;
  isClosed?: boolean;
  isException?: boolean;
  exceptionNote?: string | null;
  slots: { time: string; booked: boolean; withinWorkingHours?: boolean }[];
  appointments: (AppointmentWithPatient & { outsideWorkingHours?: boolean })[];
}

export interface MonthOverviewEntry {
  date: string;
  count: number;
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
  followUpDays: number | null;
  followUp1Days: number | null;
  followUp2Days: number | null;
  followUp3Days: number | null;
  category: string | null;
  referencePriceCents: number | null;
  scope?: TreatmentScope | null;
}

export interface PatientTreatment {
  id: number;
  patientId: number;
  treatmentTypeId: number;
  toothNumber: number | null;
  teeth: number[];
  treatmentDate: string | null;
  treatmentScope: TreatmentScope | null;
  priceCents: number;
  baseAmountCents: number;
  discountCents: number;
  finalAmountCents: number;
  status: TreatmentStatus;
  note: string | null;
  doctorId: number | null;
  completedAt?: string | null;
  completedById?: number | null;
  completedByName?: string | null;
  followUp1Days: number | null;
  followUp2Days: number | null;
  followUp3Days: number | null;
  createdAt: string;
  updatedAt: string;
  treatmentCode: string;
  treatmentAbbreviation: string;
  treatmentLabel: string;
  treatmentColor: string;
  doctorName: string | null;
}

export type PaymentStatus = 'ACTIVE' | 'VOID';

export interface AccountDiscount {
  id: number;
  patientId: number;
  amountCents: number;
  date: string;
  note: string | null;
  recordedById: number | null;
  status?: PaymentStatus;
  voidedAt?: string | null;
  voidedById?: number | null;
  voidReason?: string | null;
  voidedByName?: string | null;
  createdAt: string;
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
  status?: PaymentStatus;
  voidedAt?: string | null;
  voidedById?: number | null;
  voidReason?: string | null;
  voidedByName?: string | null;
  createdAt: string;
}

export interface AccountSummary {
  subtotalCents: number;
  accountDiscountCents: number;
  totalCostCents: number;
  totalPaidCents: number;
  remainingCents: number;
  lastPayments: Payment[];
  lastDiscounts: AccountDiscount[];
}

export interface RoleWithPermissions {
  id: number;
  name: string;
  label: string;
  isSystem: boolean;
  permissions: string[];
}

export interface UserSummary {
  id: number;
  fullName: string;
  username: string;
  isActive: boolean;
  roleName: string;
  roleLabel: string;
}

export interface PaymentMethodEntity {
  id: number;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
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
  workingDays: string;
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

export interface Prescription {
  id: number;
  patientId: number;
  doctorId: number | null;
  doctorName: string | null;
  type: PrescriptionType;
  createdAt: string;
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
  patientTreatmentId?: number | null;
  clinicalVisitNoteId?: number | null;
  teeth?: number[];
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
  diseaseCatalogId?: number | null;
  isActive: boolean;
  createdById: number | null;
  createdByName?: string | null;
  deactivatedAt?: string | null;
  deactivatedById?: number | null;
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
  updatedById?: number | null;
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

export interface FinancialSummary {
  totalTreatmentValueCents: number;
  totalDiscountCents: number;
  totalCollectedCents: number;
  outstandingBalanceCents: number;
  totalExpensesCents: number;
  netCashCents: number;
}

export interface AppointmentsSummary {
  total: number;
  scheduled: number;
  waiting: number;
  inTreatment: number;
  completed: number;
  cancelled: number;
}

export interface PatientsSummary {
  totalPatients: number;
  newPatients: number;
}

export interface ReportsSummary {
  period: { from: string; to: string };
  financial: FinancialSummary;
  appointments: AppointmentsSummary;
  patients: PatientsSummary;
}

export interface ExpenseCategoryEntity {
  id: number;
  code: string;
  label: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Guarantor {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface GuarantorTreatmentPrice {
  guarantorId: number;
  treatmentTypeId: number;
  priceCents: number;
}

export interface LabServiceCost {
  id: number;
  labNameId: number;
  workTypeCode: string;
  costCents: number;
  createdAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentReportRow extends PatientTreatment {
  patientName: string;
  patientFileNumber: string;
}

export interface PaymentReportRow extends Payment {
  patientName: string;
  patientFileNumber: string;
}

export interface OutstandingPatientRow extends Patient {
  totalCostCents: number;
  totalPaidCents: number;
  remainingCents: number;
}

export interface PatientDebtRow extends OutstandingPatientRow {
  lastPaymentDate: string | null;
  lastPaymentAmountCents: number | null;
  nextFollowUpDate: string | null;
}

export type FollowUpType = 'CLINICAL' | 'FINANCIAL';
export type FollowUpStoredStatus = 'ACTIVE' | 'COMPLETED';
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

export interface FollowUpAppointmentPayload {
  date: string;
  time: string;
  durationMin?: number;
  reason?: string;
}

export interface FollowUpPaymentPayload {
  amount: number;
  method: string;
  date?: string;
  note?: string;
}

export interface DailyReportSummary {
  newPatientsCount: number;
  paymentsCount: number;
  paymentsTotalCents: number;
  followUpsTotal: number;
  followUpsCompleted: number;
  followUpsPending: number;
  followUpsDueToday: number;
  followUpsOverdue: number;
  labCasesDueToday: number;
  labCasesOverdue: number;
  tomorrowAppointmentsCount: number;
}

export interface DailyReportFollowUpRow {
  id: number;
  patientId: number;
  patientName: string;
  type: FollowUpType;
  reason: string;
  result: FollowUpResult | null;
  note: string | null;
  status: 'COMPLETED' | 'PENDING';
  queueCategory?: 'DUE' | 'OVERDUE';
  paymentAmountCents: number | null;
  appointmentSummary: string | null;
  nextFollowUpDate: string | null;
  createdAt: string;
}

export interface DailyReportPaymentRow {
  id: number;
  patientId: number;
  patientName: string;
  amountCents: number;
  method: string;
  methodLabel?: string;
  date: string;
  createdAt: string;
}

export interface DailyReportAppointmentRow {
  id: number;
  time: string;
  patientName: string;
  reason: string | null;
  durationMin: number;
  status: AppointmentStatus;
}

export interface DailyReportLabCaseRow {
  id: number;
  patientId: number;
  patientName: string;
  labName: string;
  workTypeLabel: string;
  teeth: number[];
  expectedDeliveryDate: string | null;
  status: LabCaseStatus;
  dueAlert: LabCaseDueAlert;
}

export interface DailyReportCashMovement {
  kind: 'IN' | 'OUT';
  amountCents: number;
  label: string;
  detail: string;
  time: string;
}

export interface DailyReportCashReport {
  cashInCents: number;
  cashOutCents: number;
  balanceCents: number;
  movements: DailyReportCashMovement[];
}

export interface DailyReport {
  date: string;
  generatedAt: string;
  summary: DailyReportSummary;
  newPatients: Patient[];
  payments: DailyReportPaymentRow[];
  followUps: DailyReportFollowUpRow[];
  labCasesDue: DailyReportLabCaseRow[];
  tomorrowAppointments: DailyReportAppointmentRow[];
  todayAppointments: DailyReportAppointmentRow[];
  cashReport?: DailyReportCashReport;
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
}

export interface LabName {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
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
  voidedAt?: string | null;
  voidReason?: string | null;
  recordedByName?: string | null;
  createdAt: string;
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

export interface PatientLabCasesResponse {
  activeCount: number;
  active: LabCaseWithDetails[];
  all: LabCaseWithDetails[];
}

export interface FollowUpSummary {
  total: number;
  dueToday: number;
  overdue: number;
  completed: number;
  clinical: number;
  financial: number;
}

export interface PatientFollowUpsResponse {
  activeCount: number;
  nextFollowUpDate: string | null;
  active: FollowUpWithPatient[];
  history: FollowUpHistoryEntry[];
}
