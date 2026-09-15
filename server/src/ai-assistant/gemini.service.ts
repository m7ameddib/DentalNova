import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiChatMessage } from './ai-action.types';
import { isInsecureAiServiceSecret, PUBLIC_DEFAULT_AI_SERVICE_SECRET } from '../common/ai-service-secret.util';
import {
  AI_EMPTY_RESPONSE_MESSAGE,
  AI_FETCH_TIMEOUT_MS,
  AI_UNREADABLE_RESPONSE_MESSAGE,
  describeAiHttpStatus,
  mapAiFetchFailure,
} from './ai-reachability.util';

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string; code?: number };
}

interface ProviderGenerateResponse {
  text?: string;
  durationMs?: number;
}

@Injectable()
export class GeminiService {
  static readonly DEFAULT_MODEL = 'gemini-3.5-flash-lite';
  static readonly DEFAULT_AI_SERVICE_URL = 'https://dentalnova.dibnova.com';
  static readonly DEFAULT_AI_SERVICE_SECRET = PUBLIC_DEFAULT_AI_SERVICE_SECRET;

  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    if (this.usesOnlineAiService()) return true;
    return this.hasLocalApiKey();
  }

  hasLocalApiKey(): boolean {
    return !!this.getApiKey();
  }

  getModel(): string {
    return this.config.get<string>('GEMINI_MODEL')?.trim() || GeminiService.DEFAULT_MODEL;
  }

  /** Gemini uses one multimodal model for text and images. */
  getVisionModel(): string {
    return this.getModel();
  }

  getAiServiceSecret(): string {
    const value = this.config.get<string>('AI_SERVICE_SECRET')?.trim() || '';
    if (isInsecureAiServiceSecret(value)) return '';
    return value;
  }

  async chat(
    systemPrompt: string,
    messages: AiChatMessage[],
    options?: { imageBase64?: string; imageMimeType?: string; round?: number },
  ): Promise<{ text: string; durationMs: number }> {
    if (this.usesOnlineAiService()) {
      return this.proxyToOnlineService(systemPrompt, messages, options);
    }
    return this.callGemini(systemPrompt, messages, options);
  }

  /** Direct Gemini call for the online provider endpoint. Never proxies. */
  async generateDirect(
    systemPrompt: string,
    messages: AiChatMessage[],
    options?: { imageBase64?: string; imageMimeType?: string },
  ): Promise<{ text: string; durationMs: number }> {
    return this.callGemini(systemPrompt, messages, options);
  }

  private async callGemini(
    systemPrompt: string,
    messages: AiChatMessage[],
    options?: { imageBase64?: string; imageMimeType?: string; round?: number },
  ): Promise<{ text: string; durationMs: number }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI Assistant is not configured. Set GEMINI_API_KEY in server/.env',
      );
    }

    const contents: GeminiContent[] = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    if (options?.imageBase64 && contents.length > 0) {
      const last = contents[contents.length - 1];
      if (last.role === 'user') {
        last.parts.push({
          inlineData: {
            mimeType: options.imageMimeType || 'image/jpeg',
            data: options.imageBase64,
          },
        });
      }
    }

    const model = this.getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const geminiStart = Date.now();
    const roundLabel = options?.round != null ? ` (round ${options.round})` : '';
    this.logger.log(`Gemini request started${roundLabel}`);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      });
    } catch (err) {
      this.logger.warn(`Gemini fetch failed${roundLabel}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(mapAiFetchFailure(err));
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      this.logger.warn(`Gemini HTTP ${response.status}${roundLabel}: ${this.sanitizeError(errText).slice(0, 200)}`);
      throw new ServiceUnavailableException(describeAiHttpStatus(response.status));
    }

    let data: GeminiGenerateResponse;
    try {
      data = (await response.json()) as GeminiGenerateResponse;
    } catch {
      throw new ServiceUnavailableException(AI_UNREADABLE_RESPONSE_MESSAGE);
    }
    if (data.error?.message) {
      this.logger.warn(`Gemini API error${roundLabel}: ${this.sanitizeError(data.error.message).slice(0, 200)}`);
      throw new ServiceUnavailableException(describeAiHttpStatus(data.error.code ?? 503));
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new ServiceUnavailableException(AI_EMPTY_RESPONSE_MESSAGE);
    }

    const durationMs = Date.now() - geminiStart;
    this.logger.log(`Gemini response received in ${(durationMs / 1000).toFixed(1)}s${roundLabel}`);

    return { text, durationMs };
  }

  private async proxyToOnlineService(
    systemPrompt: string,
    messages: AiChatMessage[],
    options?: { imageBase64?: string; imageMimeType?: string; round?: number },
  ): Promise<{ text: string; durationMs: number }> {
    const baseUrl = this.getAiServiceUrl();
    if (!baseUrl) {
      throw new ServiceUnavailableException('AI service URL is not configured');
    }

    const roundLabel = options?.round != null ? ` (round ${options.round})` : '';
    this.logger.log(`AI service proxy started${roundLabel}`);
    const started = Date.now();

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/ai-provider/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dentalnova-ai-key': this.getAiServiceSecret(),
        },
        signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS),
        body: JSON.stringify({
          systemPrompt,
          messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          imageBase64: options?.imageBase64,
          imageMimeType: options?.imageMimeType,
        }),
      });
    } catch (err) {
      this.logger.warn(`AI service proxy fetch failed${roundLabel}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(mapAiFetchFailure(err));
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      this.logger.warn(`AI service HTTP ${response.status}${roundLabel}: ${this.sanitizeError(errText).slice(0, 200)}`);
      throw new ServiceUnavailableException(describeAiHttpStatus(response.status));
    }

    let data: ProviderGenerateResponse;
    try {
      data = (await response.json()) as ProviderGenerateResponse;
    } catch {
      throw new ServiceUnavailableException(AI_UNREADABLE_RESPONSE_MESSAGE);
    }
    if (!data.text?.trim()) {
      throw new ServiceUnavailableException(AI_EMPTY_RESPONSE_MESSAGE);
    }

    const durationMs = data.durationMs ?? Date.now() - started;
    this.logger.log(`AI service proxy finished in ${(durationMs / 1000).toFixed(1)}s${roundLabel}`);
    return { text: data.text, durationMs };
  }

  private usesOnlineAiService(): boolean {
    if (!this.isOfflineMode()) return false;
    return !!this.getAiServiceUrl();
  }

  private isOfflineMode(): boolean {
    return (this.config.get<string>('DEPLOYMENT_MODE') || 'offline').toLowerCase() !== 'online';
  }

  private getAiServiceUrl(): string | undefined {
    const raw = this.config.get<string>('AI_SERVICE_URL');
    if (raw !== undefined && raw.trim() === '') return undefined;
    if (!raw?.trim()) return undefined;
    return raw.trim().replace(/\/$/, '');
  }

  private getApiKey(): string | undefined {
    return this.config.get<string>('GEMINI_API_KEY')?.trim() || undefined;
  }

  /** Strip any accidental key echoes from provider error payloads. */
  private sanitizeError(raw: string): string {
    return raw.replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED]');
  }
}
