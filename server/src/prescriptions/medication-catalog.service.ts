import { Injectable, NotFoundException } from '@nestjs/common';
import { MedicationCatalogRepository } from '../database/repositories/medication-catalog.repository';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';

@Injectable()
export class MedicationCatalogService {
  constructor(private readonly repo: MedicationCatalogRepository) {}

  list() {
    return this.repo.findAll();
  }

  create(dto: CreateMedicationDto) {
    return this.repo.create({
      name: dto.name.trim(),
      strengthForm: dto.strengthForm?.trim() || null,
      category: dto.category,
      defaultDose: dto.defaultDose?.trim() || null,
      defaultFrequency: dto.defaultFrequency?.trim() || null,
      defaultDuration: dto.defaultDuration?.trim() || null,
      defaultInstructions: dto.defaultInstructions?.trim() || null,
    });
  }

  update(id: number, dto: UpdateMedicationDto) {
    const updated = this.repo.update(id, {
      name: dto.name?.trim(),
      strengthForm: dto.strengthForm !== undefined ? dto.strengthForm.trim() || null : undefined,
      category: dto.category,
      defaultDose: dto.defaultDose !== undefined ? dto.defaultDose.trim() || null : undefined,
      defaultFrequency: dto.defaultFrequency !== undefined ? dto.defaultFrequency.trim() || null : undefined,
      defaultDuration: dto.defaultDuration !== undefined ? dto.defaultDuration.trim() || null : undefined,
      defaultInstructions:
        dto.defaultInstructions !== undefined ? dto.defaultInstructions.trim() || null : undefined,
      isActive: dto.isActive,
    });
    if (!updated) throw new NotFoundException('Medication not found');
    return updated;
  }

  remove(id: number) {
    const deleted = this.repo.delete(id);
    if (!deleted) throw new NotFoundException('Medication not found');
    return { id };
  }
}
