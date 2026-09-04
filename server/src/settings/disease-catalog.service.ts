import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DiseaseCatalogRepository } from '../database/repositories/disease-catalog.repository';
import { CreateDiseaseCatalogDto, UpdateDiseaseCatalogDto } from './dto/disease-catalog.dto';

@Injectable()
export class DiseaseCatalogService {
  constructor(private readonly repo: DiseaseCatalogRepository) {}

  listActive() {
    return this.repo.findAllActive();
  }

  listAll() {
    return this.repo.findAll();
  }

  create(dto: CreateDiseaseCatalogDto) {
    const name = dto.name.trim();
    if (this.repo.findAll().some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      throw new BadRequestException('Disease already exists');
    }
    return this.repo.create({ name });
  }

  update(id: number, dto: UpdateDiseaseCatalogDto) {
    if (!this.repo.findById(id)) throw new NotFoundException('Disease not found');
    if (dto.name) {
      const name = dto.name.trim();
      const duplicate = this.repo
        .findAll()
        .find((d) => d.id !== id && d.name.toLowerCase() === name.toLowerCase());
      if (duplicate) throw new BadRequestException('Disease already exists');
    }
    return this.repo.update(id, dto);
  }

  remove(id: number) {
    if (!this.repo.findById(id)) throw new NotFoundException('Disease not found');
    const deleted = this.repo.delete(id);
    return { id, deleted };
  }
}
