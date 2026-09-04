import { Injectable, NotFoundException } from '@nestjs/common';
import { ClinicExpensesRepository } from '../database/repositories/clinic-expenses.repository';
import { ExpenseCategoriesRepository } from '../database/repositories/expense-categories.repository';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { AuthenticatedUser } from '../auth/auth.types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly expensesRepo: ClinicExpensesRepository,
    private readonly categoriesRepo: ExpenseCategoriesRepository,
  ) {}

  listForPeriod(from?: string, to?: string, search?: string) {
    const fromIso = from ?? todayIso();
    const toIso = to ?? todayIso();
    const rows = this.expensesRepo.findForPeriod(fromIso, toIso);
    if (!search?.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(
      (e) =>
        (e.note ?? '').toLowerCase().includes(q) ||
        (e.paidTo ?? '').toLowerCase().includes(q) ||
        (e.category ?? '').toLowerCase().includes(q),
    );
  }

  create(dto: CreateExpenseDto, currentUser: AuthenticatedUser) {
    const category = this.resolveCategory(dto.expenseCategoryId, dto.category);
    return this.expensesRepo.create({
      date: dto.date ?? todayIso(),
      amountCents: Math.round(dto.amount * 100),
      category: category.code,
      expenseCategoryId: category.id,
      paymentMethod: dto.paymentMethod,
      paidTo: dto.paidTo ?? null,
      note: dto.note ?? null,
      createdById: currentUser.id,
    });
  }

  update(id: number, dto: UpdateExpenseDto) {
    const existing = this.expensesRepo.findById(id);
    if (!existing) throw new NotFoundException('Expense not found');
    const category =
      dto.expenseCategoryId != null
        ? this.resolveCategory(dto.expenseCategoryId)
        : { id: existing.expenseCategoryId, code: existing.category };
    return this.expensesRepo.update(id, {
      date: dto.date,
      amountCents: dto.amount != null ? Math.round(dto.amount * 100) : undefined,
      category: category.code,
      expenseCategoryId: category.id ?? undefined,
      paymentMethod: dto.paymentMethod,
      paidTo: dto.paidTo,
      note: dto.note,
    });
  }

  remove(id: number) {
    const existing = this.expensesRepo.findById(id);
    if (!existing) throw new NotFoundException('Expense not found');
    this.expensesRepo.delete(id);
    return { id };
  }

  private resolveCategory(expenseCategoryId?: number, legacyCode?: string) {
    if (expenseCategoryId) {
      const cat = this.categoriesRepo.findById(expenseCategoryId);
      if (!cat) throw new NotFoundException('Expense category not found');
      return cat;
    }
    if (legacyCode) {
      const cat = this.categoriesRepo.findByCode(legacyCode);
      if (cat) return cat;
      return { id: null as unknown as number, code: legacyCode };
    }
    const other = this.categoriesRepo.findByCode('OTHER');
    return other ?? { id: null as unknown as number, code: 'OTHER' };
  }
}
