import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { FollowUpsRepository } from '../database/repositories/follow-ups.repository';

import { PatientsRepository } from '../database/repositories/patients.repository';

import { PaymentsRepository } from '../database/repositories/payments.repository';

import { PaymentMethodsRepository } from '../database/repositories/payment-methods.repository';

import { FollowUpResult, FollowUpType, TreatmentType } from '../common/types';

import { AuthenticatedUser } from '../auth/auth.types';

import { CreateFollowUpDto } from './dto/create-follow-up.dto';

import { CompleteFollowUpDto } from './dto/complete-follow-up.dto';

import { SetFollowUpDateDto } from './dto/set-follow-up-date.dto';

import { AddFollowUpNoteDto } from './dto/add-follow-up-note.dto';

import { UpdateFollowUpDto } from './dto/update-follow-up.dto';

import { FinancialActionDto } from './dto/financial-action.dto';

import { AppointmentsService } from '../appointments/appointments.service';



function todayIso(): string {

  return new Date().toISOString().slice(0, 10);

}



function addDays(isoDate: string, days: number): string {

  const d = new Date(`${isoDate}T12:00:00`);

  d.setDate(d.getDate() + days);

  return d.toISOString().slice(0, 10);

}



@Injectable()

export class FollowUpsService {

  constructor(

    private readonly followUpsRepo: FollowUpsRepository,

    private readonly patientsRepo: PatientsRepository,

    private readonly paymentsRepo: PaymentsRepository,

    private readonly paymentMethodsRepo: PaymentMethodsRepository,

    private readonly appointmentsService: AppointmentsService,

  ) {}



  /** Ensure financial follow-ups exist for all patients with balance > 0; complete when paid. */

  syncFinancialFollowUps() {

    const outstanding = this.patientsRepo.findOutstanding();

    const outstandingIds = new Set(outstanding.map((p) => p.id));



    for (const patient of outstanding) {

      const existing = this.followUpsRepo.findActiveFinancialByPatient(patient.id);

      if (!existing) {

        this.followUpsRepo.create({

          patientId: patient.id,

          type: 'FINANCIAL',

          reason: 'Outstanding balance',

          followUpDate: todayIso(),

          details: null,

        });

      }

    }



    const activeFinancial = this.followUpsRepo.findAllActiveFinancial();

    for (const fu of activeFinancial) {

      if (!outstandingIds.has(fu.patientId)) {

        this.followUpsRepo.complete(fu.id);

        this.followUpsRepo.addHistory({

          followUpId: fu.id,

          patientId: fu.patientId,

          type: 'FINANCIAL',

          reason: fu.reason,

          result: 'PAID',

          note: 'Balance cleared',

        });

      }

    }

  }



  createClinicalFromTreatment(

    patientId: number,

    patientTreatmentId: number,

    treatmentType: TreatmentType,

    treatmentDate: string,

    userId: number,

  ) {

    if (!treatmentType.followUpDays || treatmentType.followUpDays <= 0) return;

    const followUpDate = addDays(treatmentDate.slice(0, 10), treatmentType.followUpDays);

    this.followUpsRepo.create({

      patientId,

      type: 'CLINICAL',

      reason: `${treatmentType.label} follow-up`,

      followUpDate,

      details: treatmentType.label,

      patientTreatmentId,

      createdById: userId,

    });

  }



  createClinicalFollowUpsFromTreatment(

    patientId: number,

    patientTreatmentId: number,

    treatmentType: TreatmentType,

    treatmentDate: string,

    userId: number,

    followUpDays: (number | null)[],

  ) {

    const custom = followUpDays.filter((d): d is number => d != null && d > 0);

    if (custom.length > 0) {

      custom.forEach((days, index) => {

        const followUpDate = addDays(treatmentDate.slice(0, 10), days);

        this.followUpsRepo.create({

          patientId,

          type: 'CLINICAL',

          reason: `${treatmentType.label} follow-up ${index + 1}`,

          followUpDate,

          details: `${treatmentType.label} (+${days}d)`,

          patientTreatmentId,

          createdById: userId,

        });

      });

      return;

    }

    this.createClinicalFromTreatment(patientId, patientTreatmentId, treatmentType, treatmentDate, userId);

  }



  list(typeFilter?: FollowUpType, date?: string) {
    this.syncFinancialFollowUps();
    const targetDate = date?.slice(0, 10) ?? todayIso();
    return this.followUpsRepo.findForDate(targetDate, typeFilter).filter((fu) => {
      if (fu.type === 'FINANCIAL' && fu.status === 'ACTIVE' && (fu.remainingCents ?? 0) <= 0) {
        return false;
      }
      return true;
    });
  }

  workItemsForDate(date?: string) {
    this.syncFinancialFollowUps();
    const targetDate = date?.slice(0, 10) ?? todayIso();
    return this.followUpsRepo.findForDate(targetDate).filter((fu) => {
      if (fu.type === 'FINANCIAL' && fu.status === 'ACTIVE' && (fu.remainingCents ?? 0) <= 0) {
        return false;
      }
      return true;
    });
  }

  /** @deprecated Use workItemsForDate */
  todaysWorkItems(date?: string) {
    return this.workItemsForDate(date);
  }



  summary(date?: string) {
    this.syncFinancialFollowUps();
    const targetDate = date?.slice(0, 10) ?? todayIso();
    const items = this.followUpsRepo.findForDate(targetDate).filter((fu) => {
      if (fu.type === 'FINANCIAL' && fu.status === 'ACTIVE' && (fu.remainingCents ?? 0) <= 0) {
        return false;
      }
      return true;
    });
    const active = items.filter((fu) => fu.status === 'ACTIVE');
    const dueToday = active.filter((fu) => fu.followUpDate === targetDate).length;
    const overdue = active.filter((fu) => fu.followUpDate < targetDate).length;
    const completed = items.filter((fu) => fu.status === 'COMPLETED').length;
    const clinical = items.filter((fu) => fu.type === 'CLINICAL').length;
    const financial = items.filter((fu) => fu.type === 'FINANCIAL').length;
    return {
      total: items.length,
      dueToday,
      overdue,
      completed,
      clinical,
      financial,
    };
  }



  history(patientId?: number) {

    return this.followUpsRepo.findHistory(patientId);

  }



  forPatient(patientId: number) {

    if (!this.patientsRepo.findById(patientId)) {

      throw new NotFoundException('Patient not found');

    }

    this.syncFinancialFollowUps();

    const active = this.followUpsRepo.findByPatient(patientId).filter((fu) => fu.status === 'ACTIVE');

    const history = this.followUpsRepo.findHistory(patientId, 50);

    const nextDate = this.followUpsRepo.nextFollowUpDateForPatient(patientId);

    return {

      activeCount: active.length,

      nextFollowUpDate: nextDate,

      active,

      history,

    };

  }



  create(dto: CreateFollowUpDto, user: AuthenticatedUser) {

    if (!this.patientsRepo.findById(dto.patientId)) {

      throw new NotFoundException('Patient not found');

    }

    if (dto.type === 'FINANCIAL') {

      throw new BadRequestException('Financial follow-ups are managed automatically from account balance');

    }

    return this.followUpsRepo.create({

      patientId: dto.patientId,

      type: 'CLINICAL',

      reason: dto.reason.trim(),

      followUpDate: dto.followUpDate,

      details: dto.details?.trim() ?? null,

      note: dto.note?.trim() ?? null,

      createdById: user.id,

    });

  }



  update(id: number, dto: UpdateFollowUpDto) {

    const existing = this.followUpsRepo.findById(id);

    if (!existing || existing.status !== 'ACTIVE') {

      throw new NotFoundException('Follow-up not found');

    }

    return this.followUpsRepo.updateFields(id, {

      followUpDate: dto.followUpDate,

      reason: dto.reason?.trim(),

      details: dto.details?.trim() ?? null,

      note: dto.note?.trim() ?? null,

    });

  }



  setDate(id: number, dto: SetFollowUpDateDto, user: AuthenticatedUser) {

    const existing = this.followUpsRepo.findById(id);

    if (!existing || existing.status !== 'ACTIVE') {

      throw new NotFoundException('Follow-up not found');

    }

    const updated = this.followUpsRepo.updateDate(id, dto.followUpDate, dto.note?.trim() ?? null);

    this.followUpsRepo.addHistory({

      followUpId: id,

      patientId: existing.patientId,

      type: existing.type,

      reason: existing.reason,

      result: 'FOLLOWED_UP',

      note: dto.note?.trim() ?? `Next follow-up: ${dto.followUpDate}`,

      nextFollowUpDate: dto.followUpDate,

      performedById: user.id,

    });

    return updated;

  }



  addNote(id: number, dto: AddFollowUpNoteDto, user: AuthenticatedUser) {

    const existing = this.followUpsRepo.findById(id);

    if (!existing) throw new NotFoundException('Follow-up not found');

    const updated = this.followUpsRepo.updateNote(id, dto.note.trim());

    this.followUpsRepo.addHistory({

      followUpId: id,

      patientId: existing.patientId,

      type: existing.type,

      reason: existing.reason,

      result: 'CUSTOM',

      note: dto.note.trim(),

      performedById: user.id,

    });

    return updated;

  }



  complete(id: number, dto: CompleteFollowUpDto, user: AuthenticatedUser) {

    const existing = this.followUpsRepo.findById(id);

    if (!existing || existing.status !== 'ACTIVE') {

      throw new NotFoundException('Follow-up not found');

    }



    let appointmentId: number | null = null;

    let appointmentSummary: string | null = null;



    if (dto.result === 'NEEDS_APPOINTMENT') {

      if (!dto.appointment) {

        throw new BadRequestException('Appointment details are required');

      }

      const appt = this.appointmentsService.create(

        {

          patientId: existing.patientId,

          date: dto.appointment.date,

          time: dto.appointment.time,

          durationMin: dto.appointment.durationMin,

          reason: dto.appointment.reason ?? existing.reason,

        },

        user,

      );

      appointmentId = appt.id;

      appointmentSummary = `Appointment booked – ${dto.appointment.date} ${dto.appointment.time}`;

    }



    if (dto.result === 'NO_ANSWER' && !dto.nextFollowUpDate) {

      throw new BadRequestException('Next follow-up date is required');

    }



    const shouldReschedule =

      dto.nextFollowUpDate &&

      (dto.result === 'NO_ANSWER' ||

        dto.reschedule ||

        dto.result === 'PAIN' ||

        dto.result === 'SWELLING');



    this.followUpsRepo.addHistory({

      followUpId: id,

      patientId: existing.patientId,

      type: existing.type,

      reason: existing.reason,

      result: dto.result,

      note: dto.note?.trim() ?? null,

      nextFollowUpDate: shouldReschedule ? dto.nextFollowUpDate ?? null : dto.nextFollowUpDate ?? null,

      appointmentId,

      appointmentSummary,

      performedById: user.id,

    });



    this.followUpsRepo.complete(id);



    if (shouldReschedule && dto.nextFollowUpDate) {

      return this.followUpsRepo.create({

        patientId: existing.patientId,

        type: existing.type,

        reason: existing.reason,

        followUpDate: dto.nextFollowUpDate,

        details: existing.details,

        note: dto.note?.trim() ?? existing.note,

        patientTreatmentId: existing.patientTreatmentId,

        createdById: user.id,

      });

    }



    return { id, completed: true, patientId: existing.patientId, appointmentId, appointmentSummary };

  }



  financialAction(id: number, dto: FinancialActionDto, user: AuthenticatedUser) {

    const existing = this.followUpsRepo.findById(id);

    if (!existing || existing.status !== 'ACTIVE' || existing.type !== 'FINANCIAL') {

      throw new NotFoundException('Financial follow-up not found');

    }



    const financials = this.getPatientFinancials(existing.patientId);

    let paymentId: number | null = null;

    let paymentAmountCents: number | null = null;



    if (dto.result === 'SETTLED') {

      if (financials.remainingCents > 0) {

        throw new BadRequestException('Cannot mark as settled while a balance remains');

      }

      this.followUpsRepo.addHistory({

        followUpId: id,

        patientId: existing.patientId,

        type: existing.type,

        reason: existing.reason,

        result: 'SETTLED',

        note: dto.note?.trim() ?? null,

        performedById: user.id,

      });

      this.followUpsRepo.complete(id);

      return { id, completed: true, patientId: existing.patientId };

    }



    if (dto.result === 'PAID_INSTALLMENT') {

      if (!dto.payment) {

        throw new BadRequestException('Payment details are required');

      }

      const method = this.paymentMethodsRepo.findByCode(dto.payment.method);

      if (!method || !method.isActive) {

        throw new BadRequestException('Select a valid payment method');

      }

      const payment = this.paymentsRepo.create({

        patientId: existing.patientId,

        amountCents: Math.round(dto.payment.amount * 100),

        method: dto.payment.method,

        date: dto.payment.date ?? todayIso(),

        note: dto.payment.note ?? null,

        recordedById: user.id,

      });

      paymentId = payment.id;

      paymentAmountCents = payment.amountCents;

      this.syncFinancialFollowUps();

    }



    if (dto.result === 'NO_ANSWER' || dto.result === 'PROMISED_PAYMENT') {

      if (!dto.nextFollowUpDate) {

        throw new BadRequestException('Next follow-up date is required');

      }

      this.followUpsRepo.updateDate(id, dto.nextFollowUpDate, dto.note?.trim() ?? null);

    }



    if (dto.result === 'REMINDER_SENT' && dto.nextFollowUpDate) {

      this.followUpsRepo.updateDate(id, dto.nextFollowUpDate, dto.note?.trim() ?? null);

    }



    this.followUpsRepo.addHistory({

      followUpId: id,

      patientId: existing.patientId,

      type: existing.type,

      reason: existing.reason,

      result: dto.result,

      note: dto.note?.trim() ?? null,

      nextFollowUpDate: dto.nextFollowUpDate ?? null,

      paymentId,

      paymentAmountCents,

      performedById: user.id,

    });



    return {

      id,

      patientId: existing.patientId,

      paymentId,

      paymentAmountCents,

      remainingCents: this.getPatientFinancials(existing.patientId).remainingCents,

    };

  }



  private getPatientFinancials(patientId: number) {

    const outstanding = this.patientsRepo.findOutstanding().find((p) => p.id === patientId);

    if (outstanding) {

      return {

        totalCostCents: outstanding.totalCostCents,

        totalPaidCents: outstanding.totalPaidCents,

        remainingCents: outstanding.remainingCents,

      };

    }

    const patient = this.patientsRepo.findById(patientId);

    if (!patient) throw new NotFoundException('Patient not found');

    return { totalCostCents: 0, totalPaidCents: 0, remainingCents: 0 };

  }



  /** Remove clinical follow-ups linked to a deleted treatment. */
  deleteByTreatmentId(treatmentId: number) {
    this.followUpsRepo.deleteByTreatmentId(treatmentId);
  }

  /** Called after payment changes to refresh financial follow-up state. */

  onPaymentChanged(patientId: number) {

    this.syncFinancialFollowUps();

  }

}

