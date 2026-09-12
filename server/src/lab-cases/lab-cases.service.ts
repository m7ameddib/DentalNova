import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LabCasesRepository, LabCaseListFilter } from '../database/repositories/lab-cases.repository';
import {
  computeLabPaymentStatus,
  LabCasePaymentsRepository,
} from '../database/repositories/lab-case-payments.repository';
import { LabWorkTypesRepository } from '../database/repositories/lab-work-types.repository';
import { LabNamesRepository } from '../database/repositories/lab-names.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { PatientTreatmentsRepository } from '../database/repositories/patient-treatments.repository';
import { ClinicExpensesRepository } from '../database/repositories/clinic-expenses.repository';
import { PaymentMethodsRepository } from '../database/repositories/payment-methods.repository';
import { LabServiceCostsRepository } from '../database/repositories/lab-service-costs.repository';
import { LabAccountPaymentsRepository } from '../database/repositories/lab-account-payments.repository';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import {
  LabAccountPaymentRow,
  LabAccountSummary,
  LabCaseStatus,
  LabCaseWithDetails,
  LabStatementLine,
} from '../common/types';
import { CreateLabCaseDto, UpdateLabCaseDto } from './dto/lab-case.dto';
import { RecordLabPaymentDto, UpdateLabPaymentDto, VoidLabPaymentDto } from './dto/lab-payment.dto';
import {
  RecordLabAccountPaymentDto,
  UpdateLabAccountPaymentDto,
  VoidLabAccountPaymentDto,
} from './dto/lab-account-payment.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { localTodayIso } from '../common/local-date.util';

@Injectable()
export class LabCasesService {
  constructor(
    private readonly labCasesRepo: LabCasesRepository,
    private readonly labPaymentsRepo: LabCasePaymentsRepository,
    private readonly workTypesRepo: LabWorkTypesRepository,
    private readonly labNamesRepo: LabNamesRepository,
    private readonly labServiceCostsRepo: LabServiceCostsRepository,
    private readonly labAccountPaymentsRepo: LabAccountPaymentsRepository,
    private readonly patientsRepo: PatientsRepository,
    private readonly treatmentsRepo: PatientTreatmentsRepository,
    private readonly expensesRepo: ClinicExpensesRepository,
    private readonly paymentMethodsRepo: PaymentMethodsRepository,
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  listWorkTypes() {
    return this.workTypesRepo.findAllActive();
  }

  listLabNames() {
    return this.labNamesRepo.findAllActive();
  }

  listAllLabNames() {
    return this.labNamesRepo.findAll();
  }

  createLabName(name: string, phone: string) {
    if (!name?.trim()) throw new BadRequestException('Lab name is required');
    if (!phone?.trim()) throw new BadRequestException('Lab phone number is required');
    return this.labNamesRepo.create(name.trim(), phone.trim());
  }

  updateLabName(id: number, input: { name?: string; phone?: string | null; isActive?: boolean }) {
    const updated = this.labNamesRepo.update(id, input);
    if (!updated) throw new NotFoundException('Laboratory not found');
    return updated;
  }

  deleteLabName(id: number) {
    const updated = this.labNamesRepo.update(id, { isActive: false });
    if (!updated) throw new NotFoundException('Laboratory not found');
    return updated;
  }

  listServiceCosts(labNameId: number) {
    if (!this.labNamesRepo.findById(labNameId)) throw new NotFoundException('Laboratory not found');
    return this.labServiceCostsRepo.findByLab(labNameId);
  }

  upsertServiceCost(labNameId: number, workTypeCode: string, cost: number) {
    if (!this.labNamesRepo.findById(labNameId)) throw new NotFoundException('Laboratory not found');
    return this.labServiceCostsRepo.upsert(labNameId, workTypeCode, Math.round(cost * 100));
  }

  lookupServiceCost(labName: string, workTypeCode: string): number | undefined {
    const lab = this.labNamesRepo.findAll().find((n) => n.name.toLowerCase() === labName.trim().toLowerCase());
    if (!lab) return undefined;
    return this.labServiceCostsRepo.findCost(lab.id, workTypeCode);
  }

  list(filter?: LabCaseListFilter, search?: string) {
    return this.labCasesRepo.list(filter ?? 'active', search).map((c) => this.enrichFinancials(c));
  }

  summary(date?: string) {
    const target = date?.slice(0, 10) ?? localTodayIso();
    return this.labCasesRepo.summaryForDate(target);
  }

  getById(id: number) {
    const row = this.labCasesRepo.findById(id);
    if (!row) throw new NotFoundException('Lab case not found');
    const enriched = this.enrichFinancials(row);
    return {
      ...enriched,
      history: this.labCasesRepo.findHistory(id),
      payments: this.labPaymentsRepo.findByLabCase(id),
    };
  }

  forPatient(patientId: number) {
    if (!this.patientsRepo.findById(patientId)) {
      throw new NotFoundException('Patient not found');
    }
    const active = this.labCasesRepo.findByPatient(patientId, true).map((c) => this.enrichFinancials(c));
    const all = this.labCasesRepo.findByPatient(patientId, false).map((c) => this.enrichFinancials(c));
    return { activeCount: active.length, active, all };
  }

  create(dto: CreateLabCaseDto, user: AuthenticatedUser) {
    this.assertPatient(dto.patientId);
    this.assertWorkType(dto.workTypeCode, dto.workTypeCustom);
    this.assertTreatment(dto.patientId, dto.patientTreatmentId);
    this.ensureLabNameSaved(dto.labName);

    let labCost = dto.labCost;
    if (labCost == null) {
      const configured = this.lookupServiceCost(dto.labName, dto.workTypeCode);
      if (configured != null) labCost = configured / 100;
    }

    const created = this.labCasesRepo.create({
      patientId: dto.patientId,
      patientTreatmentId: dto.patientTreatmentId ?? null,
      labName: dto.labName,
      workTypeCode: dto.workTypeCode,
      workTypeCustom: dto.workTypeCustom ?? null,
      status: dto.status ?? 'PENDING',
      labCostCents: labCost != null ? Math.round(labCost * 100) : 0,
      sentDate: dto.sentDate ?? null,
      expectedDeliveryDate: dto.expectedDeliveryDate ?? null,
      receivedDate: dto.receivedDate ?? null,
      deliveredDate: dto.deliveredDate ?? null,
      notes: dto.notes ?? null,
      teeth: dto.teeth,
      createdById: user.id,
    });

    this.labCasesRepo.insertHistory({
      labCaseId: created.id,
      patientId: created.patientId,
      action: 'CREATED',
      toStatus: created.status,
      performedById: user.id,
    });

    return this.enrichFinancials(created);
  }

  update(id: number, dto: UpdateLabCaseDto, user: AuthenticatedUser) {
    const existing = this.labCasesRepo.findById(id);
    if (!existing) throw new NotFoundException('Lab case not found');

    const workTypeCode = dto.workTypeCode ?? existing.workTypeCode;
    const workTypeCustom =
      dto.workTypeCustom !== undefined ? dto.workTypeCustom : existing.workTypeCustom ?? undefined;
    this.assertWorkType(workTypeCode, workTypeCustom);

    if (dto.patientTreatmentId !== undefined && dto.patientTreatmentId != null) {
      this.assertTreatment(existing.patientId, dto.patientTreatmentId);
    }

    if (dto.labName) {
      this.ensureLabNameSaved(dto.labName);
    }

    const prevStatus = existing.status;
    const updated = this.labCasesRepo.update(id, {
      patientTreatmentId: dto.patientTreatmentId,
      labName: dto.labName,
      workTypeCode: dto.workTypeCode,
      workTypeCustom: dto.workTypeCustom,
      status: dto.status,
      labCostCents: dto.labCost != null ? Math.round(dto.labCost * 100) : undefined,
      sentDate: dto.sentDate,
      expectedDeliveryDate: dto.expectedDeliveryDate,
      receivedDate: dto.receivedDate,
      deliveredDate: dto.deliveredDate,
      notes: dto.notes,
      teeth: dto.teeth,
    });

    this.recordUpdateHistory(existing.id, existing.patientId, prevStatus, updated!, user.id, dto);
    return this.enrichFinancials(updated!);
  }

  recordPayment(labCaseId: number, dto: RecordLabPaymentDto, user: AuthenticatedUser) {
    const labCase = this.labCasesRepo.findById(labCaseId);
    if (!labCase) throw new NotFoundException('Lab case not found');

    const method = this.paymentMethodsRepo.findByCode(dto.paymentMethod);
    if (!method || !method.isActive) {
      throw new BadRequestException('Select a valid payment method');
    }

    const amountCents = Math.round(dto.amount * 100);
    if (amountCents <= 0) throw new BadRequestException('Payment amount must be greater than zero');

    const totalPaid = this.labPaymentsRepo.totalPaidForCase(labCaseId);
    const remaining = Math.max(0, labCase.labCostCents - totalPaid);
    if (labCase.labCostCents > 0 && amountCents > remaining) {
      throw new BadRequestException('Payment exceeds remaining lab balance');
    }

    const paymentDate = dto.paymentDate ?? localTodayIso();
    const note = dto.note?.trim() || `Lab payment — ${labCase.labName} (${labCase.workTypeLabel})`;

    const payment = this.db.connection.transaction(() => {
      const expense = this.expensesRepo.create({
        date: paymentDate,
        amountCents,
        category: 'LAB',
        paymentMethod: dto.paymentMethod,
        note,
        createdById: user.id,
        sourceLabPaymentId: null,
      });

      const createdPayment = this.labPaymentsRepo.create({
        labCaseId,
        amountCents,
        paymentMethod: dto.paymentMethod,
        paymentDate,
        note: dto.note ?? null,
        expenseId: expense.id,
        recordedById: user.id,
      });

      this.db.connection
        .prepare(`UPDATE clinic_expenses SET source_lab_payment_id = ? WHERE id = ?`)
        .run(createdPayment.id, expense.id);

      return this.labPaymentsRepo.findById(createdPayment.id)!;
    })();

    this.audit.log({
      action: 'LAB_PAYMENT_RECORDED',
      entityType: 'lab_case_payment',
      entityId: payment.id,
      patientId: labCase.patientId,
      description: `Lab payment ${(amountCents / 100).toFixed(2)} for case #${labCaseId}`,
      userId: user.id,
    });

    return payment;
  }

  updatePayment(labCaseId: number, paymentId: number, dto: UpdateLabPaymentDto, user: AuthenticatedUser) {
    const payment = this.labPaymentsRepo.findById(paymentId);
    if (!payment || payment.labCaseId !== labCaseId) {
      throw new NotFoundException('Lab payment not found');
    }
    if (payment.status === 'VOID') {
      throw new BadRequestException('Cannot edit a voided payment');
    }

    const labCase = this.labCasesRepo.findById(labCaseId);
    if (!labCase) throw new NotFoundException('Lab case not found');

    if (dto.paymentMethod) {
      const method = this.paymentMethodsRepo.findByCode(dto.paymentMethod);
      if (!method || !method.isActive) {
        throw new BadRequestException('Select a valid payment method');
      }
    }

    const amountCents = dto.amount !== undefined ? Math.round(dto.amount * 100) : payment.amountCents;
    if (amountCents <= 0) throw new BadRequestException('Payment amount must be greater than zero');

    const othersPaid = this.labPaymentsRepo.totalPaidForCase(labCaseId) - payment.amountCents;
    const remaining = Math.max(0, labCase.labCostCents - othersPaid);
    if (labCase.labCostCents > 0 && amountCents > remaining) {
      throw new BadRequestException('Updated payment exceeds remaining lab balance');
    }

    const updated = this.db.connection.transaction(() => {
      const row = this.labPaymentsRepo.update(paymentId, {
        amountCents,
        paymentMethod: dto.paymentMethod,
        paymentDate: dto.paymentDate,
        note: dto.note !== undefined ? dto.note ?? null : undefined,
      });
      if (!row) throw new NotFoundException('Lab payment not found');
      if (payment.expenseId) {
        this.expensesRepo.update(payment.expenseId, {
          amountCents: row.amountCents,
          date: row.paymentDate,
          paymentMethod: row.paymentMethod,
          note: row.note ?? `Lab payment — ${labCase.labName} (${labCase.workTypeLabel})`,
        });
      }
      return row;
    })();

    this.audit.log({
      action: 'LAB_PAYMENT_UPDATED',
      entityType: 'lab_case_payment',
      entityId: paymentId,
      patientId: labCase.patientId,
      description: `Lab payment updated for case #${labCaseId}`,
      userId: user.id,
    });

    return updated;
  }

  voidPayment(labCaseId: number, paymentId: number, dto: VoidLabPaymentDto, user: AuthenticatedUser) {
    const payment = this.labPaymentsRepo.findById(paymentId);
    if (!payment || payment.labCaseId !== labCaseId) {
      throw new NotFoundException('Lab payment not found');
    }
    if (payment.status === 'VOID') {
      throw new BadRequestException('Payment is already voided');
    }

    const voided = this.labPaymentsRepo.void(paymentId, user.id, dto.reason.trim());
    if (!voided) throw new BadRequestException('Payment could not be voided');

    if (payment.expenseId) {
      this.expensesRepo.void(payment.expenseId, user.id, dto.reason.trim());
    }

    const labCase = this.labCasesRepo.findById(labCaseId);
    this.audit.log({
      action: 'LAB_PAYMENT_VOIDED',
      entityType: 'lab_case_payment',
      entityId: paymentId,
      patientId: labCase?.patientId,
      description: `Lab payment voided: ${dto.reason.trim()}`,
      userId: user.id,
    });

    return voided;
  }

  listPayments(labCaseId: number) {
    if (!this.labCasesRepo.findById(labCaseId)) {
      throw new NotFoundException('Lab case not found');
    }
    return this.labPaymentsRepo.findByLabCase(labCaseId);
  }

  // ── Laboratory account (aggregated per lab_names row) ──

  listLabAccounts(): LabAccountSummary[] {
    return this.labNamesRepo.findAll().map((lab) => this.buildLabAccountSummary(lab.id, lab.name));
  }

  getLabAccount(labNameId: number, fromDate?: string, toDate?: string): LabAccountSummary {
    const lab = this.assertLab(labNameId);
    return this.buildLabAccountSummary(lab.id, lab.name, fromDate, toDate);
  }

  listLabAccountOrders(labNameId: number, fromDate?: string, toDate?: string) {
    const lab = this.assertLab(labNameId);
    return this.labCasesRepo.findByLabName(lab.name, fromDate, toDate).map((c) => this.enrichFinancials(c));
  }

  listLabAccountPayments(labNameId: number, fromDate?: string, toDate?: string): LabAccountPaymentRow[] {
    const lab = this.assertLab(labNameId);
    const casePayments = this.labCasesRepo.findCasePaymentsForLab(lab.name, fromDate, toDate);
    const labPayments = this.labAccountPaymentsRepo.findByLab(labNameId, fromDate, toDate);

    const rows: LabAccountPaymentRow[] = [
      ...casePayments.map((p) => ({
        id: p.id,
        source: 'CASE' as const,
        labCaseId: p.labCaseId,
        amountCents: p.amountCents,
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate,
        note: p.note,
        status: p.status,
        voidReason: p.voidReason,
        recordedByName: p.recordedByName ?? null,
        createdAt: p.createdAt,
        patientName: p.patientName,
        patientFileNumber: p.patientFileNumber,
        workTypeLabel: p.workTypeLabel,
        editable: false,
      })),
      ...labPayments.map((p) => ({
        id: p.id,
        source: 'LAB' as const,
        labCaseId: null,
        amountCents: p.amountCents,
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate,
        note: p.note,
        status: p.status,
        voidReason: p.voidReason,
        recordedByName: p.recordedByName ?? null,
        createdAt: p.createdAt,
        editable: p.status !== 'VOID',
      })),
    ];

    return rows.sort((a, b) => {
      const d = b.paymentDate.localeCompare(a.paymentDate);
      return d !== 0 ? d : b.id - a.id;
    });
  }

  getLabStatement(labNameId: number, fromDate?: string, toDate?: string): LabStatementLine[] {
    const lab = this.assertLab(labNameId);
    const orders = this.labCasesRepo.findByLabName(lab.name, fromDate, toDate);
    const casePayments = this.labCasesRepo.findCasePaymentsForLab(lab.name, fromDate, toDate);
    const labPayments = this.labAccountPaymentsRepo.findByLab(labNameId, fromDate, toDate);

    type RawLine = { date: string; sortKey: string; description: string; debit: number; credit: number };
    const raw: RawLine[] = [];

    for (const order of orders) {
      const date = order.sentDate ?? order.createdAt.slice(0, 10);
      const teeth = order.teeth.length > 0 ? ` · #${order.teeth.join(',')}` : '';
      raw.push({
        date,
        sortKey: `${date}#D${String(order.id).padStart(8, '0')}`,
        description: `Order #${order.id} — ${order.workTypeLabel} — ${order.patientName}${teeth}`,
        debit: order.labCostCents,
        credit: 0,
      });
    }

    for (const p of casePayments) {
      if (p.status === 'VOID') continue;
      raw.push({
        date: p.paymentDate,
        sortKey: `${p.paymentDate}#C${String(p.id).padStart(8, '0')}`,
        description: `Payment (case #${p.labCaseId}) — ${p.patientName} — ${p.workTypeLabel}`,
        debit: 0,
        credit: p.amountCents,
      });
    }

    for (const p of labPayments) {
      if (p.status === 'VOID') continue;
      raw.push({
        date: p.paymentDate,
        sortKey: `${p.paymentDate}#L${String(p.id).padStart(8, '0')}`,
        description: p.note?.trim() ? `Payment — ${p.note.trim()}` : 'Payment',
        debit: 0,
        credit: p.amountCents,
      });
    }

    raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    let balance = 0;
    return raw.map((line) => {
      balance += line.debit - line.credit;
      return {
        date: line.date,
        description: line.description,
        debitCents: line.debit,
        creditCents: line.credit,
        balanceCents: balance,
      };
    });
  }

  recordLabAccountPayment(labNameId: number, dto: RecordLabAccountPaymentDto, user: AuthenticatedUser) {
    const lab = this.assertLab(labNameId);
    const method = this.paymentMethodsRepo.findByCode(dto.paymentMethod);
    if (!method || !method.isActive) {
      throw new BadRequestException('Select a valid payment method');
    }

    const amountCents = Math.round(dto.amount * 100);
    if (amountCents <= 0) throw new BadRequestException('Payment amount must be greater than zero');

    const summary = this.buildLabAccountSummary(lab.id, lab.name);
    if (summary.remainingCents > 0 && amountCents > summary.remainingCents) {
      throw new BadRequestException('Payment exceeds remaining lab balance');
    }

    const paymentDate = dto.paymentDate ?? localTodayIso();
    const note = dto.note?.trim() || `Lab payment — ${lab.name}`;

    const payment = this.db.connection.transaction(() => {
      const expense = this.expensesRepo.create({
        date: paymentDate,
        amountCents,
        category: 'LAB',
        paymentMethod: dto.paymentMethod,
        note,
        createdById: user.id,
        sourceLabPaymentId: null,
      });

      const createdPayment = this.labAccountPaymentsRepo.create({
        labNameId,
        amountCents,
        paymentMethod: dto.paymentMethod,
        paymentDate,
        note: dto.note ?? null,
        expenseId: expense.id,
        recordedById: user.id,
      });

      return createdPayment;
    })();

    this.audit.log({
      action: 'LAB_ACCOUNT_PAYMENT_RECORDED',
      entityType: 'lab_account_payment',
      entityId: payment.id,
      description: `Lab account payment ${(amountCents / 100).toFixed(2)} — ${lab.name}`,
      userId: user.id,
    });

    return payment;
  }

  updateLabAccountPayment(
    labNameId: number,
    paymentId: number,
    dto: UpdateLabAccountPaymentDto,
    user: AuthenticatedUser,
  ) {
    this.assertLab(labNameId);
    const existing = this.labAccountPaymentsRepo.findById(paymentId);
    if (!existing || existing.labNameId !== labNameId) {
      throw new NotFoundException('Lab payment not found');
    }
    if (existing.status === 'VOID') {
      throw new BadRequestException('Cannot edit a voided payment');
    }

    const amountCents =
      dto.amount !== undefined ? Math.round(dto.amount * 100) : existing.amountCents;
    if (amountCents <= 0) throw new BadRequestException('Payment amount must be greater than zero');

    if (dto.paymentMethod) {
      const method = this.paymentMethodsRepo.findByCode(dto.paymentMethod);
      if (!method || !method.isActive) {
        throw new BadRequestException('Select a valid payment method');
      }
    }

    const lab = this.assertLab(labNameId);
    const summary = this.buildLabAccountSummary(lab.id, lab.name);
    const delta = amountCents - existing.amountCents;
    if (delta > 0 && summary.remainingCents > 0 && delta > summary.remainingCents) {
      throw new BadRequestException('Updated payment exceeds remaining lab balance');
    }

    const updated = this.db.connection.transaction(() => {
      const row = this.labAccountPaymentsRepo.update(paymentId, {
        amountCents,
        paymentMethod: dto.paymentMethod,
        paymentDate: dto.paymentDate,
        note: dto.note !== undefined ? dto.note ?? null : undefined,
      });
      if (!row) throw new NotFoundException('Lab payment not found');

      if (existing.expenseId) {
        this.expensesRepo.update(existing.expenseId, {
          amountCents: row.amountCents,
          date: row.paymentDate,
          paymentMethod: row.paymentMethod,
          note: row.note ?? `Lab payment — ${lab.name}`,
        });
      }
      return row;
    })();

    this.audit.log({
      action: 'LAB_ACCOUNT_PAYMENT_UPDATED',
      entityType: 'lab_account_payment',
      entityId: paymentId,
      description: `Lab account payment updated — ${lab.name}`,
      userId: user.id,
    });

    return updated;
  }

  voidLabAccountPayment(
    labNameId: number,
    paymentId: number,
    dto: VoidLabAccountPaymentDto,
    user: AuthenticatedUser,
  ) {
    this.assertLab(labNameId);
    const existing = this.labAccountPaymentsRepo.findById(paymentId);
    if (!existing || existing.labNameId !== labNameId) {
      throw new NotFoundException('Lab payment not found');
    }
    if (existing.status === 'VOID') {
      throw new BadRequestException('Payment is already voided');
    }

    const voided = this.labAccountPaymentsRepo.void(paymentId, user.id, dto.reason.trim());
    if (!voided) throw new BadRequestException('Payment could not be voided');

    if (existing.expenseId) {
      this.expensesRepo.void(existing.expenseId, user.id, dto.reason.trim());
    }

    this.audit.log({
      action: 'LAB_ACCOUNT_PAYMENT_VOIDED',
      entityType: 'lab_account_payment',
      entityId: paymentId,
      description: `Lab account payment voided: ${dto.reason.trim()}`,
      userId: user.id,
    });

    return voided;
  }

  private buildLabAccountSummary(
    labNameId: number,
    labName: string,
    fromDate?: string,
    toDate?: string,
  ): LabAccountSummary {
    const totalCents = this.labCasesRepo.totalCostForLab(labName, fromDate, toDate);
    const casePaid = this.labCasesRepo.totalCasePaymentsForLab(labName, fromDate, toDate);
    const labPaid = this.labAccountPaymentsRepo.totalPaidForLab(labNameId, fromDate, toDate);
    const paidCents = casePaid + labPaid;
    return {
      labNameId,
      labName,
      totalCents,
      paidCents,
      remainingCents: Math.max(0, totalCents - paidCents),
    };
  }

  private assertLab(labNameId: number) {
    const lab = this.labNamesRepo.findById(labNameId);
    if (!lab) throw new NotFoundException('Laboratory not found');
    return lab;
  }

  private enrichFinancials(row: LabCaseWithDetails): LabCaseWithDetails {
    const totalPaidCents = this.labPaymentsRepo.totalPaidForCase(row.id);
    const remainingLabBalanceCents = Math.max(0, row.labCostCents - totalPaidCents);
    return {
      ...row,
      totalPaidCents,
      remainingLabBalanceCents,
      labPaymentStatus: computeLabPaymentStatus(row.labCostCents, totalPaidCents),
    };
  }

  private recordUpdateHistory(
    labCaseId: number,
    patientId: number,
    prevStatus: LabCaseStatus,
    updated: { status: LabCaseStatus; receivedDate: string | null; deliveredDate: string | null },
    userId: number,
    dto: UpdateLabCaseDto,
  ) {
    if (dto.status && dto.status !== prevStatus) {
      let action = 'STATUS_CHANGED';
      if (dto.status === 'RECEIVED_FROM_LAB') action = 'RECEIVED';
      else if (dto.status === 'DELIVERED_TO_PATIENT') action = 'DELIVERED';
      else if (dto.status === 'CANCELLED') action = 'CANCELLED';

      this.labCasesRepo.insertHistory({
        labCaseId,
        patientId,
        action,
        fromStatus: prevStatus,
        toStatus: dto.status,
        performedById: userId,
      });
      return;
    }

    this.labCasesRepo.insertHistory({
      labCaseId,
      patientId,
      action: 'EDITED',
      fromStatus: prevStatus,
      toStatus: updated.status,
      performedById: userId,
    });
  }

  private assertPatient(patientId: number) {
    if (!this.patientsRepo.findById(patientId)) {
      throw new NotFoundException('Patient not found');
    }
  }

  private assertWorkType(code: string, custom?: string | null) {
    const wt = this.workTypesRepo.findByCode(code);
    if (!wt || !wt.isActive) {
      throw new BadRequestException('Invalid work type');
    }
    if (code === 'OTHER' && !custom?.trim()) {
      throw new BadRequestException('Custom work type description is required when Other is selected');
    }
  }

  private assertTreatment(patientId: number, treatmentId?: number | null) {
    if (treatmentId == null) return;
    const t = this.treatmentsRepo.findById(treatmentId);
    if (!t || t.patientId !== patientId) {
      throw new BadRequestException('Treatment does not belong to this patient');
    }
  }

  private ensureLabNameSaved(labName: string) {
    const trimmed = labName.trim();
    if (!trimmed) throw new BadRequestException('Lab name is required');
    const existing = this.labNamesRepo.findAll().find((n) => n.name.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      try {
        this.labNamesRepo.create(trimmed);
      } catch {
        /* unique constraint */
      }
    }
  }
}

