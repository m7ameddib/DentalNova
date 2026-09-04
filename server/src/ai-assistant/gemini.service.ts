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

@Injectable()
export class GeminiService {
  private static readonly DEFAULT_MODEL = 'gemini-3.6-flash';
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.getApiKey();
  }

  getModel(): string {
    return this.config.get<string>('GEMINI_MODEL')?.trim() || GeminiService.DEFAULT_MODEL;
  }

  /** Gemini uses one multimodal model for text and images. */
  getVisionModel(): string {
    return this.getModel();
  }

  async chat(
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

  private getApiKey(): string | undefined {
    return this.config.get<string>('GEMINI_API_KEY')?.trim() || undefined;
  }

  /** Strip any accidental key echoes from provider error payloads. */
  private sanitizeError(raw: string): string {
    return raw.replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED]');
  }
}
