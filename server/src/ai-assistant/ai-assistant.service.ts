import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { AiActionExecutor } from './ai-action.executor';
import { AiContextBuilder } from './ai-context.builder';
import { GeminiService } from './gemini.service';
import {
  AiChatMessage,
  AiChatResult,
  AiImageAnalysisResult,
  AiProposedAction,
  AiTimingInfo,
  isMutationAction,
  isReadAction,
} from './ai-action.types';

interface ParsedLlmResponse {
  reply?: string;
  readAction?: { action: string; params?: Record<string, unknown> } | null;
  proposedAction?: AiProposedAction | null;
  imageAnalysis?: AiImageAnalysisResult | null;
}

const MAX_READ_ROUNDS = 4;

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly provider: GeminiService,
    private readonly contextBuilder: AiContextBuilder,
    private readonly executor: AiActionExecutor,
  ) {}

  getStatus() {
    return {
      configured: this.provider.isConfigured(),
      model: this.provider.getModel(),
      visionModel: this.provider.getVisionModel(),
    };
  }

  async chat(
    user: AuthenticatedUser,
    history: AiChatMessage[],
    userMessage: string,
    imageBase64?: string,
    imageMimeType?: string,
    clientSentAt?: number,
  ): Promise<AiChatResult> {
    const serverStart = Date.now();
    const clientToServerMs =
      clientSentAt != null && clientSentAt > 0 ? Math.max(0, serverStart - clientSentAt) : undefined;

    if (clientToServerMs != null) {
      this.logger.log(`Client→server: ${clientToServerMs}ms`);
    }

    const systemPrompt = this.contextBuilder.buildSystemPrompt(user);
    const conversation: AiChatMessage[] = [
      ...history,
      {
        role: 'user',
        content: userMessage || (imageBase64 ? 'Analyze this doctor paper / image.' : ''),
      },
    ];

    let parsed: ParsedLlmResponse | null = null;
    let rounds = 0;
    let geminiTotalMs = 0;
    let readActionsMs = 0;

    while (rounds < MAX_READ_ROUNDS) {
      rounds += 1;
      const { text: raw, durationMs } = await this.provider.chat(systemPrompt, conversation, {
        imageBase64: rounds === 1 ? imageBase64 : undefined,
        imageMimeType,
        round: rounds,
      });
      geminiTotalMs += durationMs;
      parsed = this.parseLlmJson(raw);

      if (!parsed.readAction?.action) {
        break;
      }

      const readAction = parsed.readAction.action;
      if (!isReadAction(readAction)) {
        conversation.push({ role: 'assistant', content: raw });
        conversation.push({
          role: 'user',
          content: JSON.stringify({ error: `Unknown read action: ${readAction}` }),
        });
        continue;
      }

      if (!this.executor.userCan(user, readAction)) {
        conversation.push({ role: 'assistant', content: raw });
        conversation.push({
          role: 'user',
          content: JSON.stringify({ error: `Permission denied for ${readAction}` }),
        });
        continue;
      }

      const readStart = Date.now();
      try {
        const result = this.executor.executeRead(user, readAction, parsed.readAction.params ?? {});
        conversation.push({ role: 'assistant', content: raw });
        conversation.push({
          role: 'user',
          content: JSON.stringify({ readActionResult: result }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Read action failed';
        conversation.push({ role: 'assistant', content: raw });
        conversation.push({
          role: 'user',
          content: JSON.stringify({ readActionError: message }),
        });
      }
      readActionsMs += Date.now() - readStart;
    }

    const serverTotalMs = Date.now() - serverStart;
    const backendProcessingMs = Math.max(0, serverTotalMs - geminiTotalMs - readActionsMs);
    const timing: AiTimingInfo = {
      clientToServerMs,
      serverTotalMs,
      geminiTotalMs,
      readActionsMs,
      rounds,
    };

    this.logger.log(
      `AI timing — gemini: ${(geminiTotalMs / 1000).toFixed(1)}s, read-actions: ${readActionsMs}ms, backend processing: ${backendProcessingMs}ms, total: ${(serverTotalMs / 1000).toFixed(1)}s (${rounds} round(s))`,
    );

    const reply = parsed?.reply?.trim() || 'Sorry, I could not process that request.';
    let proposedAction = parsed?.proposedAction ?? undefined;

    if (proposedAction?.action) {
      if (!isMutationAction(proposedAction.action)) {
        proposedAction = undefined;
      } else if (!this.executor.userCan(user, proposedAction.action)) {
        return {
          reply: `${reply}\n\n(You do not have permission to perform: ${proposedAction.action})`,
          imageAnalysis: parsed?.imageAnalysis ?? undefined,
          timing,
        };
      }
    }

    return {
      reply,
      proposedAction,
      imageAnalysis: parsed?.imageAnalysis ?? undefined,
      timing,
    };
  }

  executeAction(user: AuthenticatedUser, action: string, params: Record<string, unknown>) {
    if (!isMutationAction(action)) {
      throw new BadRequestException('Invalid or non-mutation action');
    }
    return this.executor.executeMutation(user, action, params);
  }

  private parseLlmJson(raw: string): ParsedLlmResponse {
    try {
      return JSON.parse(raw) as ParsedLlmResponse;
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as ParsedLlmResponse;
        } catch {
          return { reply: raw };
        }
      }
      return { reply: raw };
    }
  }
}
