import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  ServiceUnavailableException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { SKIP_INSTALLATION_GUARD } from '../installation/guards/installation-ready.guard';
import { SkipSubscriptionGuard } from '../subscription/decorators/skip-subscription-guard.decorator';
import { GeminiService } from './gemini.service';
import { AiProviderGenerateDto } from './dto/ai-provider.dto';

@Controller('ai-provider')
@SetMetadata(SKIP_INSTALLATION_GUARD, true)
@SkipSubscriptionGuard()
export class AiProviderController {
  private readonly logger = new Logger(AiProviderController.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly config: ConfigService,
  ) {}

  @Post('generate')
  async generate(
    @Headers('x-dentalnova-ai-key') providedKey: string | undefined,
    @Body() dto: AiProviderGenerateDto,
  ) {
    if (!this.isOnlineMode()) {
      throw new ServiceUnavailableException('AI provider is only available in online mode');
    }
    if (!this.secretsMatch(providedKey, this.gemini.getAiServiceSecret())) {
      throw new UnauthorizedException('Invalid AI service key');
    }
    if (!this.gemini.hasLocalApiKey()) {
      throw new ServiceUnavailableException('Online AI is not configured');
    }

    this.logger.log(`AI provider generate (messages=${dto.messages.length})`);
    return this.gemini.generateDirect(dto.systemPrompt, dto.messages, {
      imageBase64: dto.imageBase64,
      imageMimeType: dto.imageMimeType,
    });
  }

  private isOnlineMode(): boolean {
    return (this.config.get<string>('DEPLOYMENT_MODE') || 'offline').toLowerCase() === 'online';
  }

  private secretsMatch(provided: string | undefined, expected: string): boolean {
    if (!provided || !expected) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
