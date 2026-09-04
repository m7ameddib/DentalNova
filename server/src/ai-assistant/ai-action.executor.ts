import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';
import { TreatmentsService } from '../treatments/treatments.service';
import { PaymentsService } from '../payments/payments.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { CreatePatientDto } from '../patients/dto/create-patient.dto';
import { UpdatePatientDto } from '../patients/dto/update-patient.dto';
import { CreateTreatmentDto } from '../treatments/dto/create-treatment.dto';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import {
  AI_ACTION_PERMISSIONS,
  AI_PRINT_ACTIONS,
  AiActionName,
  AiExecuteResult,
  AiMutationActionName,
  AiReadActionName,
  isPrintAction,
} from './ai-action.types';

@Injectable()
export class AiActionExecutor {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly treatmentsService: TreatmentsService,
    private readonly paymentsService: PaymentsService,
    private readonly appointmentsService: AppointmentsService,
    private readonly audit: AuditService,
  ) {}

  userCan(user: AuthenticatedUser, action: AiActionName): boolean {
    const perm = AI_ACTION_PERMISSIONS[action];
    return user.permissions.includes(perm);
  }

  assertCan(user: AuthenticatedUser, action: AiActionName) {
    if (!this.userCan(user, action)) {
      throw new ForbiddenException(`You do not have permission for: ${action}`);
    }
  }

  executeRead(user: AuthenticatedUser, action: AiReadActionName, params: Record<string, unknown>) {
    this.assertCan(user, action);
    switch (action) {
      case 'search_patient': {
        const query = String(params.query ?? '').trim();
        const results = this.patientsService.search(query || undefined);
        return results.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          fileNumber: p.fileNumber,
          phone: p.phone,
        }));
      }
      case 'get_patient': {
        const id = this.requireInt(params.patientId, 'patientId');
        const patient = this.patientsService.getById(id);
        return {
          id: patient.id,
          fullName: patient.fullName,
          fileNumber: patient.fileNumber,
          phone: patient.phone,
          gender: patient.gender,
          dateOfBirth: patient.dateOfBirth,
          approxAge: patient.approxAge,
          areaId: patient.areaId,
          generalNotes: patient.generalNotes,
        };
      }
      case 'get_balance': {
        const id = this.requireInt(params.patientId, 'patientId');
        const summary = this.patientsService.getAccountSummary(id);
        return {
          patientId: id,
          totalCostCents: summary.totalCostCents,
          totalPaidCents: summary.totalPaidCents,
          remainingCents: summary.remainingCents,
          balanceDue: summary.remainingCents / 100,
        };
      }
      case 'get_patient_payments': {
        const id = this.requireInt(params.patientId, 'patientId');
        const payments = this.patientsService.getPayments(id);
        return payments.map((p) => ({
          id: p.id,
          amount: p.amountCents / 100,
          method: p.method,
          date: p.date,
          note: p.note,
        }));
      }
      case 'get_daily_appointments': {
        const date = String(params.date ?? new Date().toISOString().slice(0, 10));
        const schedule = this.appointmentsService.getDaySchedule(date);
        return schedule.appointments.map((a) => ({
          id: a.id,
          time: a.time,
          patientName: a.patientName,
          patientId: a.patientId,
          status: a.status,
          reason: a.reason,
          durationMin: a.durationMin,
        }));
      }
      case 'get_patient_appointments': {
        const id = this.requireInt(params.patientId, 'patientId');
        return this.patientsService.getUpcomingAppointments(id);
      }
      case 'get_treatment_catalog': {
        return this.treatmentsService.listTreatmentTypes().map((t) => ({
          id: t.id,
          label: t.label,
          abbreviation: t.abbreviation,
          defaultPrice: t.defaultPriceCents / 100,
        }));
      }
      default:
        throw new BadRequestException(`Unknown read action: ${action}`);
    }
  }

  executeMutation(
    user: AuthenticatedUser,
    action: AiMutationActionName,
    params: Record<string, unknown>,
  ): AiExecuteResult {
    this.assertCan(user, action);

    if (isPrintAction(action)) {
      return this.executePrint(user, action, params);
    }

    switch (action) {
      case 'create_patient': {
        const dto: CreatePatientDto = {
          fullName: this.requireString(params.fullName, 'fullName'),
          phone: this.requireString(params.phone, 'phone'),
          gender: params.gender ? String(params.gender) : undefined,
          dateOfBirth: params.dateOfBirth ? String(params.dateOfBirth) : undefined,
          approxAge: params.approxAge != null ? Number(params.approxAge) : undefined,
          areaId: params.areaId != null ? Number(params.areaId) : undefined,
          generalNotes: params.generalNotes ? String(params.generalNotes) : undefined,
        };
        const created = this.patientsService.create(dto);
        this.audit.log({
          action: 'AI_PATIENT_CREATED',
          entityType: 'patient',
          entityId: created.id,
          patientId: created.id,
          description: `AI Assistant created patient: ${created.fullName}`,
          userId: user.id,
        });
        return {
          success: true,
          message: `Patient ${created.fullName} created (File #${created.fileNumber}).`,
          data: created,
        };
      }
      case 'update_patient': {
        const id = this.requireInt(params.patientId, 'patientId');
        const dto: UpdatePatientDto = {};
        if (params.fullName != null) dto.fullName = String(params.fullName);
        if (params.phone != null) dto.phone = String(params.phone);
        if (params.gender != null) dto.gender = String(params.gender);
        if (params.dateOfBirth != null) dto.dateOfBirth = String(params.dateOfBirth);
        if (params.approxAge != null) dto.approxAge = Number(params.approxAge);
        if (params.generalNotes != null) dto.generalNotes = String(params.generalNotes);
        const updated = this.patientsService.update(id, dto, user);
        this.audit.log({
          action: 'AI_PATIENT_UPDATED',
          entityType: 'patient',
          entityId: id,
          patientId: id,
          description: `AI Assistant updated patient: ${updated.fullName}`,
          userId: user.id,
        });
        return {
          success: true,
          message: `Patient ${updated.fullName} updated.`,
          data: updated,
        };
      }
      case 'add_treatment': {
        const dto: CreateTreatmentDto = {
          patientId: this.requireInt(params.patientId, 'patientId'),
          treatmentTypeId: this.requireInt(params.treatmentTypeId, 'treatmentTypeId'),
          teeth: this.requireTeeth(params.teeth),
          discount: params.discount != null ? Number(params.discount) : undefined,
          status: (params.status as CreateTreatmentDto['status']) ?? 'PLANNED',
          note: params.note ? String(params.note) : undefined,
        };
        const created = this.treatmentsService.create(dto, user);
        this.audit.log({
          action: 'AI_TREATMENT_ADDED',
          entityType: 'treatment',
          entityId: created.id,
          patientId: dto.patientId,
          description: `AI Assistant added treatment for patient #${dto.patientId}`,
          userId: user.id,
        });
        return {
          success: true,
          message: 'Treatment added successfully.',
          data: created,
        };
      }
      case 'update_treatment': {
        const treatmentId = this.requireInt(params.treatmentId, 'treatmentId');
        const status = String(params.status ?? '').trim();
        if (!['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'VOID'].includes(status)) {
          throw new BadRequestException('status must be PLANNED, IN_PROGRESS, COMPLETED, or VOID');
        }
        const updated = this.treatmentsService.updateStatus(
          treatmentId,
          { status: status as 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VOID' },
          user,
        );
        this.audit.log({
          action: 'AI_TREATMENT_UPDATED',
          entityType: 'treatment',
          entityId: treatmentId,
          patientId: updated.patientId,
          description: `AI Assistant updated treatment #${treatmentId} status to ${status}`,
          userId: user.id,
        });
        return {
          success: true,
          message: `Treatment status updated to ${status}.`,
          data: updated,
        };
      }
      case 'add_payment': {
        const dto: CreatePaymentDto = {
          patientId: this.requireInt(params.patientId, 'patientId'),
          amount: Number(params.amount),
          method: String(params.method ?? 'CASH'),
          date: params.date ? String(params.date) : undefined,
          note: params.note ? String(params.note) : undefined,
        };
        if (!dto.amount || dto.amount <= 0) {
          throw new BadRequestException('Payment amount must be greater than zero');
        }
        const payment = this.paymentsService.create(dto, user);
        this.audit.log({
          action: 'AI_PAYMENT_ADDED',
          entityType: 'payment',
          entityId: payment.id,
          patientId: dto.patientId,
          description: `AI Assistant recorded payment of ${dto.amount} for patient #${dto.patientId}`,
          userId: user.id,
        });
        return {
          success: true,
          message: `Payment of ${dto.amount} recorded.`,
          data: payment,
        };
      }
      case 'create_appointment': {
        const dto: CreateAppointmentDto = {
          patientId: this.requireInt(params.patientId, 'patientId'),
          date: this.requireString(params.date, 'date'),
          time: this.requireString(params.time, 'time'),
          durationMin: params.durationMin != null ? Number(params.durationMin) : 30,
          reason: params.reason ? String(params.reason) : undefined,
          notes: params.notes ? String(params.notes) : undefined,
          allowOutsideHours: params.allowOutsideHours === true,
        };
        const created = this.appointmentsService.create(dto, user);
        this.audit.log({
          action: 'AI_APPOINTMENT_CREATED',
          entityType: 'appointment',
          entityId: created.id,
          patientId: dto.patientId,
          description: `AI Assistant created appointment ${dto.date} ${dto.time}`,
          userId: user.id,
        });
        return {
          success: true,
          message: `Appointment booked for ${dto.date} at ${dto.time}.`,
          data: created,
        };
      }
      case 'update_appointment': {
        const appointmentId = this.requireInt(params.appointmentId, 'appointmentId');
        const dto: UpdateAppointmentDto = {};
        if (params.date != null) dto.date = String(params.date);
        if (params.time != null) dto.time = String(params.time);
        if (params.durationMin != null) dto.durationMin = Number(params.durationMin);
        if (params.reason != null) dto.reason = String(params.reason);
        if (params.allowOutsideHours === true) dto.allowOutsideHours = true;
        const updated = this.appointmentsService.update(appointmentId, dto, user);
        this.audit.log({
          action: 'AI_APPOINTMENT_UPDATED',
          entityType: 'appointment',
          entityId: appointmentId,
          patientId: updated?.patientId ?? undefined,
          description: `AI Assistant updated appointment #${appointmentId}`,
          userId: user.id,
        });
        return {
          success: true,
          message: 'Appointment updated.',
          data: updated,
        };
      }
      case 'cancel_appointment': {
        const appointmentId = this.requireInt(params.appointmentId, 'appointmentId');
        const updated = this.appointmentsService.updateStatus(
          appointmentId,
          { status: 'CANCELLED' },
          user,
        );
        this.audit.log({
          action: 'AI_APPOINTMENT_UPDATED',
          entityType: 'appointment',
          entityId: appointmentId,
          patientId: updated?.patientId ?? undefined,
          description: `AI Assistant cancelled appointment #${appointmentId}`,
          userId: user.id,
        });
        return {
          success: true,
          message: 'Appointment cancelled.',
          data: updated,
        };
      }
      default:
        throw new BadRequestException(`Unknown mutation action: ${action}`);
    }
  }

  private executePrint(
    user: AuthenticatedUser,
    action: AiMutationActionName,
    params: Record<string, unknown>,
  ): AiExecuteResult {
    if (!(AI_PRINT_ACTIONS as string[]).includes(action)) {
      throw new BadRequestException(`Unknown print action: ${action}`);
    }

    let description: string;
    let message: string;
    let patientId: number | undefined;
    const printParams: Record<string, unknown> = { ...params };

    switch (action) {
      case 'print_patient_file':
      case 'print_invoice':
      case 'print_patient_report': {
        patientId = this.requireInt(params.patientId, 'patientId');
        const patient = this.patientsService.getById(patientId);
        description = `AI Assistant print ${action} for ${patient.fullName}`;
        message = `Opening print preview for ${patient.fullName}.`;
        printParams.patientId = patientId;
        break;
      }
      case 'print_daily_appointments': {
        const date = String(params.date ?? new Date().toISOString().slice(0, 10));
        printParams.date = date;
        description = `AI Assistant print daily appointments for ${date}`;
        message = `Opening daily appointments print for ${date}.`;
        break;
      }
      case 'print_financial_report': {
        const today = new Date().toISOString().slice(0, 10);
        const from = String(params.from ?? today);
        const to = String(params.to ?? today);
        printParams.from = from;
        printParams.to = to;
        description = `AI Assistant print financial report ${from} — ${to}`;
        message = `Opening financial report print (${from} — ${to}).`;
        break;
      }
      default:
        throw new BadRequestException(`Unknown print action: ${action}`);
    }

    this.audit.log({
      action: 'AI_REPORT_PRINTED',
      entityType: 'report',
      patientId,
      description,
      userId: user.id,
    });

    return {
      success: true,
      message,
      clientPrint: { action, params: printParams },
    };
  }

  private requireString(value: unknown, field: string): string {
    const s = String(value ?? '').trim();
    if (!s) throw new BadRequestException(`${field} is required`);
    return s;
  }

  private requireInt(value: unknown, field: string): number {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return n;
  }

  private requireTeeth(value: unknown): number[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('teeth must be a non-empty array of tooth numbers');
    }
    return value.map((t) => {
      const n = Number(t);
      if (!Number.isInteger(n)) throw new BadRequestException('Invalid tooth number');
      return n;
    });
  }
}
