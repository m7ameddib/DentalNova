import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AreasRepository } from '../database/repositories/areas.repository';
import { CreateAreaDto, UpdateAreaDto } from './dto/area.dto';

@Injectable()
export class AreasService {
  constructor(private readonly repo: AreasRepository) {}

  listActive() {
    return this.repo.findAllActive();
  }

  listAll() {
    return this.repo.findAll();
  }

  create(dto: CreateAreaDto) {
    const name = dto.name.trim();
    if (this.repo.findAll().some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      throw new BadRequestException('Area already exists');
    }
    return this.repo.create({ name });
  }

  update(id: number, dto: UpdateAreaDto) {
    if (!this.repo.findById(id)) throw new NotFoundException('Area not found');
    if (dto.name) {
      const name = dto.name.trim();
      const duplicate = this.repo.findAll().find((a) => a.id !== id && a.name.toLowerCase() === name.toLowerCase());
      if (duplicate) throw new BadRequestException('Area already exists');
    }
    return this.repo.update(id, dto);
  }

  remove(id: number) {
    if (!this.repo.findById(id)) throw new NotFoundException('Area not found');
    const deleted = this.repo.delete(id);
    return { id, deleted };
  }
}
