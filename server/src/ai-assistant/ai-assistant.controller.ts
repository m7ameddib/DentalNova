import { Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PERMISSIONS } from '../common/rbac.constants';
import { AiAssistantService } from './ai-assistant.service';
import { AiChatDto, AiExecuteActionDto } from './dto/ai-assistant.dto';

@Controller('ai-assistant')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.AI_ASSISTANT_USE)
export class AiAssistantController {
  private readonly logger = new Logger(AiAssistantController.name);

  constructor(private readonly aiService: AiAssistantService) {}

  @Get('status')
  status() {
    return this.aiService.getStatus();
  }

  @Post('chat')
  async chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: AiChatDto) {
    const requestStart = Date.now();
    this.logger.log(`AI request started (user=${user.id}, history=${dto.history?.length ?? 0})`);

    const result = await this.aiService.chat(
      user,
      dto.history ?? [],
      dto.message,
      dto.imageBase64,
      dto.imageMimeType,
      dto.clientSentAt,
    );

    const httpTotalMs = Date.now() - requestStart;
    this.logger.log(`AI total response time: ${(httpTotalMs / 1000).toFixed(1)}s (user=${user.id})`);

    if (result.timing) {
      const serverToClientEstimate = Math.max(0, httpTotalMs - result.timing.serverTotalMs);
      this.logger.log(
        `AI timing breakdown — client→server: ${result.timing.clientToServerMs ?? 'n/a'}ms, backend→Gemini: ${result.timing.geminiTotalMs}ms, Gemini→backend: included, read-actions: ${result.timing.readActionsMs}ms, backend→client (est.): ${serverToClientEstimate}ms`,
      );
    }

    return result;
  }

  @Post('execute-action')
  executeAction(@CurrentUser() user: AuthenticatedUser, @Body() dto: AiExecuteActionDto) {
    const requestStart = Date.now();
    this.logger.log(`AI execute-action started (user=${user.id}, action=${dto.action})`);
    const result = this.aiService.executeAction(user, dto.action, dto.params);
    this.logger.log(
      `AI execute-action finished in ${Date.now() - requestStart}ms (user=${user.id}, action=${dto.action})`,
    );
    return result;
  }
}
