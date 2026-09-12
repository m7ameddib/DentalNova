import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GuarantorsRepository } from '../database/repositories/guarantors.repository';

@Injectable()
export class GuarantorsService {
  constructor(private readonly repo: GuarantorsRepository) {}

  list() {
    return this.repo.findAll();
  }

  listActive() {
    return this.repo.findAllActive();
  }

  create(name: string) {
    if (!name?.trim()) throw new BadRequestException('Guarantor name is required');
    return this.repo.create(name);
  }

  update(id: number, input: { name?: string; isActive?: boolean }) {
    const updated = this.repo.update(id, input);
    if (!updated) throw new NotFoundException('Guarantor not found');
    return updated;
  }

  listPrices(guarantorId: number) {
    if (!this.repo.findById(guarantorId)) throw new NotFoundException('Guarantor not found');
    return this.repo.listPrices(guarantorId);
  }

  upsertPrice(guarantorId: number, treatmentTypeId: number, price: number) {
    if (!this.repo.findById(guarantorId)) throw new NotFoundException('Guarantor not found');
    this.repo.upsertPrice(guarantorId, treatmentTypeId, Math.round(price * 100));
    return { guarantorId, treatmentTypeId, priceCents: Math.round(price * 100) };
  }

  deletePrice(guarantorId: number, treatmentTypeId: number) {
    this.repo.deletePrice(guarantorId, treatmentTypeId);
    return { ok: true };
  }

  remove(id: number) {
    if (!this.repo.findById(id)) throw new NotFoundException('Guarantor not found');
    const deleted = this.repo.delete(id);
    if (!deleted) throw new NotFoundException('Guarantor not found');
    return { id, deleted: true };
  }
}
