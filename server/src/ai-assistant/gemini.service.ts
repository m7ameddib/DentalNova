import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiChatMessage } from './ai-action.types';

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
  static readonly DEFAULT_AI_SERVICE_SECRET = 'DentalNova.AI.Proxy.v1';

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
    return this.config.get<string>('AI_SERVICE_SECRET')?.trim() || GeminiService.DEFAULT_AI_SERVICE_SECRET;
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new ServiceUnavailableException(
        `Gemini API error: ${response.status} ${this.sanitizeError(errText).slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as GeminiGenerateResponse;
    if (data.error?.message) {
      throw new ServiceUnavailableException(`Gemini API error: ${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new ServiceUnavailableException('Empty response from Gemini');
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

    const response = await fetch(`${baseUrl}/api/ai-provider/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dentalnova-ai-key': this.getAiServiceSecret(),
      },
      body: JSON.stringify({
        systemPrompt,
        messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        imageBase64: options?.imageBase64,
        imageMimeType: options?.imageMimeType,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new ServiceUnavailableException(
        `AI service error: ${response.status} ${this.sanitizeError(errText).slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as ProviderGenerateResponse;
    if (!data.text?.trim()) {
      throw new ServiceUnavailableException('Empty response from AI service');
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
    return (raw?.trim() || GeminiService.DEFAULT_AI_SERVICE_URL).replace(/\/$/, '');
  }

  private getApiKey(): string | undefined {
    return this.config.get<string>('GEMINI_API_KEY')?.trim() || undefined;
  }

  /** Strip any accidental key echoes from provider error payloads. */
  private sanitizeError(raw: string): string {
    return raw.replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED]');
  }
}
