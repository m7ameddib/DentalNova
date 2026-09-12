import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountDiscountsRepository } from '../database/repositories/account-discounts.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { AuditService } from '../audit/audit.service';
import { CreateAccountDiscountDto } from './dto/create-account-discount.dto';
import { UpdateAccountDiscountDto } from './dto/update-account-discount.dto';
import { VoidAccountDiscountDto } from './dto/void-account-discount.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { localTodayIso } from '../common/local-date.util';

@Injectable()
export class AccountDiscountsService {
  constructor(
    private readonly discountsRepo: AccountDiscountsRepository,
    private readonly patientsRepo: PatientsRepository,
    private readonly followUpsService: FollowUpsService,
    private readonly audit: AuditService,
  ) {}

  create(dto: CreateAccountDiscountDto, currentUser: AuthenticatedUser) {
    if (!this.patientsRepo.findById(dto.patientId)) {
      throw new NotFoundException('Patient not found');
    }
    const discount = this.discountsRepo.create({
      patientId: dto.patientId,
      amountCents: Math.round(dto.amount * 100),
      date: dto.date ?? localTodayIso(),
      note: dto.note ?? null,
      recordedById: currentUser.id,
    });
    this.followUpsService.onPaymentChanged(dto.patientId);
    this.audit.log({
      action: 'ACCOUNT_DISCOUNT_RECORDED',
      entityType: 'account_discount',
      entityId: discount.id,
      patientId: dto.patientId,
      description: `Account discount recorded: ${(discount.amountCents / 100).toFixed(2)}`,
      userId: currentUser.id,
    });
    return discount;
  }

  update(id: number, dto: UpdateAccountDiscountDto, currentUser: AuthenticatedUser) {
    const existing = this.discountsRepo.findById(id);
    if (!existing) throw new NotFoundException('Discount entry not found');
    if (existing.status === 'VOID') {
      throw new BadRequestException('Cannot edit a voided discount');
    }
    const updated = this.discountsRepo.update(id, {
      amountCents: dto.amount !== undefined ? Math.round(dto.amount * 100) : undefined,
      date: dto.date,
      note: dto.note !== undefined ? dto.note.trim() || null : undefined,
    });
    if (!updated) throw new BadRequestException('Discount entry could not be updated');
    this.followUpsService.onPaymentChanged(existing.patientId);
    this.audit.log({
      action: 'ACCOUNT_DISCOUNT_UPDATED',
      entityType: 'account_discount',
      entityId: id,
      patientId: existing.patientId,
      description: `Account discount updated: ${(updated.amountCents / 100).toFixed(2)}`,
      userId: currentUser.id,
    });
    return updated;
  }

  void(id: number, dto: VoidAccountDiscountDto, currentUser: AuthenticatedUser) {
    const existing = this.discountsRepo.findById(id);
    if (!existing) throw new NotFoundException('Discount entry not found');
    if (existing.status === 'VOID') {
      throw new BadRequestException('Discount entry is already voided');
    }
    const voided = this.discountsRepo.void(id, currentUser.id, dto.reason.trim());
    if (!voided) throw new NotFoundException('Discount entry could not be voided');
    this.followUpsService.onPaymentChanged(existing.patientId);
    this.audit.log({
      action: 'ACCOUNT_DISCOUNT_VOIDED',
      entityType: 'account_discount',
      entityId: id,
      patientId: existing.patientId,
      description: `Account discount voided: ${dto.reason.trim()}`,
      userId: currentUser.id,
    });
    return voided;
  }
}
