import { Module } from '@nestjs/common';
import { PatientsModule } from '../patients/patients.module';
import { TreatmentsModule } from '../treatments/treatments.module';
import { PaymentsModule } from '../payments/payments.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiActionExecutor } from './ai-action.executor';
import { AiContextBuilder } from './ai-context.builder';
import { GeminiService } from './gemini.service';

@Module({
  imports: [PatientsModule, TreatmentsModule, PaymentsModule, AppointmentsModule],
  controllers: [AiAssistantController],
  providers: [AiAssistantService, AiActionExecutor, AiContextBuilder, GeminiService],
})
export class AiAssistantModule {}
