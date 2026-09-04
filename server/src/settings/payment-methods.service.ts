import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethodsRepository } from '../database/repositories/payment-methods.repository';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly repo: PaymentMethodsRepository) {}

  listActive() {
    return this.repo.findAllActive();
  }

  listAll() {
    return this.repo.findAll();
  }

  create(dto: CreatePaymentMethodDto) {
    const code = this.generateCode(dto.label);
    if (this.repo.findByCode(code)) {
      throw new BadRequestException('A payment method with a similar name already exists');
    }
    return this.repo.create({ code, label: dto.label.trim() });
  }

  update(id: number, dto: UpdatePaymentMethodDto) {
    if (!this.repo.findById(id)) throw new NotFoundException('Payment method not found');
    return this.repo.update(id, { label: dto.label?.trim(), isActive: dto.isActive });
  }

  private generateCode(label: string): string {
    return label
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
