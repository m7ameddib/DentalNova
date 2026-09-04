export type AiReadActionName =
  | 'search_patient'
  | 'get_patient'
  | 'get_balance'
  | 'get_patient_payments'
  | 'get_daily_appointments'
  | 'get_patient_appointments'
  | 'get_treatment_catalog';

export type AiMutationActionName =
  | 'create_patient'
  | 'update_patient'
  | 'add_treatment'
  | 'update_treatment'
  | 'add_payment'
  | 'create_appointment'
  | 'update_appointment'
  | 'cancel_appointment'
  | 'print_patient_file'
  | 'print_invoice'
  | 'print_daily_appointments'
  | 'print_financial_report'
  | 'print_patient_report';

export type AiActionName = AiReadActionName | AiMutationActionName;

export const AI_READ_ACTIONS: AiReadActionName[] = [
  'search_patient',
  'get_patient',
  'get_balance',
  'get_patient_payments',
  'get_daily_appointments',
  'get_patient_appointments',
  'get_treatment_catalog',
];

export const AI_MUTATION_ACTIONS: AiMutationActionName[] = [
  'create_patient',
  'update_patient',
  'add_treatment',
  'update_treatment',
  'add_payment',
  'create_appointment',
  'update_appointment',
  'cancel_appointment',
  'print_patient_file',
  'print_invoice',
  'print_daily_appointments',
  'print_financial_report',
  'print_patient_report',
];

export const AI_PRINT_ACTIONS: AiMutationActionName[] = [
  'print_patient_file',
  'print_invoice',
  'print_daily_appointments',
  'print_financial_report',
  'print_patient_report',
];

export const AI_ACTION_PERMISSIONS: Record<AiActionName, string> = {
  search_patient: 'patients.view',
  get_patient: 'patients.view',
  get_balance: 'payments.view',
  get_patient_payments: 'payments.view',
  get_daily_appointments: 'appointments.view',
  get_patient_appointments: 'appointments.view',
  get_treatment_catalog: 'treatments.view',
  create_patient: 'patients.create',
  update_patient: 'patients.edit',
  add_treatment: 'treatments.create',
  update_treatment: 'treatments.create',
  add_payment: 'payments.create',
  create_appointment: 'appointments.create',
  update_appointment: 'appointments.edit',
  cancel_appointment: 'appointments.edit',
  print_patient_file: 'patients.view',
  print_invoice: 'patients.view',
  print_daily_appointments: 'appointments.view',
  print_financial_report: 'reports.financial.view',
  print_patient_report: 'patients.view',
};

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiProposedAction {
  action: AiMutationActionName;
  params: Record<string, unknown>;
  display: Record<string, string>;
  label: string;
}

export interface AiImageAnalysisResult {
  patientName: string | null;
  treatments: Array<{
    treatmentLabel: string;
    treatmentTypeId: number | null;
    teeth: number[];
    price: number | null;
    note: string | null;
  }>;
  notes: string | null;
  rawText: string | null;
}

export interface AiChatResult {
  reply: string;
  proposedAction?: AiProposedAction;
  imageAnalysis?: AiImageAnalysisResult;
  timing?: AiTimingInfo;
}

export interface AiTimingInfo {
  clientToServerMs?: number;
  serverTotalMs: number;
  geminiTotalMs: number;
  readActionsMs: number;
  rounds: number;
}

export interface AiClientPrintInstruction {
  action: AiMutationActionName;
  params: Record<string, unknown>;
}

export interface AiExecuteResult {
  success: boolean;
  message: string;
  data?: unknown;
  clientPrint?: AiClientPrintInstruction;
}

export function isReadAction(action: string): action is AiReadActionName {
  return (AI_READ_ACTIONS as string[]).includes(action);
}

export function isMutationAction(action: string): action is AiMutationActionName {
  return (AI_MUTATION_ACTIONS as string[]).includes(action);
}

export function isPrintAction(action: string): boolean {
  return (AI_PRINT_ACTIONS as string[]).includes(action);
}
