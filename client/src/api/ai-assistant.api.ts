import { apiClient } from './client';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
  proposedAction?: AiProposedAction;
  imageAnalysis?: AiImageAnalysis;
}

export interface AiProposedAction {
  action: string;
  label: string;
  params: Record<string, unknown>;
  display: Record<string, string>;
}

export interface AiImageAnalysis {
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

export interface AiChatResponse {
  reply: string;
  proposedAction?: AiProposedAction;
  imageAnalysis?: AiImageAnalysis;
  timing?: {
    clientToServerMs?: number;
    serverTotalMs: number;
    geminiTotalMs: number;
    readActionsMs: number;
    rounds: number;
  };
}

export interface AiExecuteResponse {
  success: boolean;
  message: string;
  data?: unknown;
  clientPrint?: {
    action: string;
    params: Record<string, unknown>;
  };
}

export interface AiStatusResponse {
  configured: boolean;
  model: string;
  visionModel: string;
}

export const aiAssistantApi = {
  status: () => apiClient.get<AiStatusResponse>('/ai-assistant/status').then((r) => r.data),

  chat: (payload: {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    imageBase64?: string;
    imageMimeType?: string;
    clientSentAt?: number;
  }) => apiClient.post<AiChatResponse>('/ai-assistant/chat', payload).then((r) => r.data),

  executeAction: (action: string, params: Record<string, unknown>) =>
    apiClient
      .post<AiExecuteResponse>('/ai-assistant/execute-action', { action, params })
      .then((r) => r.data),
};
