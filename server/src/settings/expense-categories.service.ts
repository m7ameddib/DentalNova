import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseCategoriesRepository } from '../database/repositories/expense-categories.repository';

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly repo: ExpenseCategoriesRepository) {}

  list() {
    return this.repo.findAll();
  }

  listActive() {
    return this.repo.findAllActive();
  }

  create(label: string) {
    if (!label?.trim()) throw new BadRequestException('Category label is required');
    return this.repo.create(label);
  }

  update(id: number, input: { label?: string; isActive?: boolean }) {
    const updated = this.repo.update(id, input);
    if (!updated) throw new NotFoundException('Expense category not found');
    return updated;
  }
}
