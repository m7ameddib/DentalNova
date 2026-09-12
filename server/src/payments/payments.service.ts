import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentsRepository } from '../database/repositories/payments.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { PaymentMethodsRepository } from '../database/repositories/payment-methods.repository';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepo: PaymentsRepository,
    private readonly patientsRepo: PatientsRepository,
    private readonly paymentMethodsRepo: PaymentMethodsRepository,
    private readonly followUpsService: FollowUpsService,
    private readonly audit: AuditService,
  ) {}

  create(dto: CreatePaymentDto, currentUser: AuthenticatedUser) {
    if (!this.patientsRepo.findById(dto.patientId)) {
      throw new NotFoundException('Patient not found');
    }
    const method = this.paymentMethodsRepo.findByCode(dto.method);
    if (!method || !method.isActive) {
      throw new BadRequestException('Select a valid payment method');
    }
    const payment = this.paymentsRepo.create({
      patientId: dto.patientId,
      amountCents: Math.round(dto.amount * 100),
      method: dto.method,
      date: dto.date ?? new Date().toISOString().slice(0, 10),
      note: dto.note ?? null,
      recordedById: currentUser.id,
    });
    this.followUpsService.onPaymentChanged(dto.patientId);
    this.audit.log({
      action: 'PAYMENT_RECORDED',
      entityType: 'payment',
      entityId: payment.id,
      patientId: dto.patientId,
      description: `Payment recorded: ${(payment.amountCents / 100).toFixed(2)}`,
      userId: currentUser.id,
    });
    return payment;
  }

  update(id: number, dto: UpdatePaymentDto, currentUser: AuthenticatedUser) {
    const existing = this.paymentsRepo.findById(id);
    if (!existing) throw new NotFoundException('Payment not found');
    if (existing.status === 'VOID') {
      throw new BadRequestException('Cannot edit a voided payment');
    }
    if (dto.method) {
      const method = this.paymentMethodsRepo.findByCode(dto.method);
      if (!method || !method.isActive) {
        throw new BadRequestException('Select a valid payment method');
      }
    }
    const updated = this.paymentsRepo.update(id, {
      amountCents: dto.amount !== undefined ? Math.round(dto.amount * 100) : undefined,
      method: dto.method,
      date: dto.date,
      note: dto.note !== undefined ? dto.note.trim() || null : undefined,
    });
    if (!updated) throw new BadRequestException('Payment could not be updated');
    this.followUpsService.onPaymentChanged(existing.patientId);
    this.audit.log({
      action: 'PAYMENT_UPDATED',
      entityType: 'payment',
      entityId: id,
      patientId: existing.patientId,
      description: `Payment updated: ${(updated.amountCents / 100).toFixed(2)}`,
      userId: currentUser.id,
    });
    return updated;
  }

  void(id: number, dto: VoidPaymentDto, currentUser: AuthenticatedUser) {
    const existing = this.paymentsRepo.findById(id);
    if (!existing) throw new NotFoundException('Payment not found');
    if (existing.status === 'VOID') {
      throw new BadRequestException('Payment is already voided');
    }
    const voided = this.paymentsRepo.void(id, currentUser.id, dto.reason.trim());
    if (!voided) throw new BadRequestException('Payment could not be voided');
    this.followUpsService.onPaymentChanged(existing.patientId);
    this.audit.log({
      action: 'PAYMENT_VOIDED',
      entityType: 'payment',
      entityId: id,
      patientId: existing.patientId,
      description: `Payment voided: ${dto.reason.trim()}`,
      userId: currentUser.id,
    });
    return voided;
  }

  /** @deprecated Use void — payments must remain in history. */
  remove(id: number) {
    throw new BadRequestException('Payments cannot be deleted. Use void instead.');
  }
}

