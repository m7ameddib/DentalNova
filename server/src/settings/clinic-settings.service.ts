import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ClinicSettingsRepository } from '../database/repositories/clinic-settings.repository';
import { UploadsService } from '../common/uploads.service';
import { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';

@Injectable()
export class ClinicSettingsService {
  constructor(
    private readonly repo: ClinicSettingsRepository,
    private readonly uploads: UploadsService,
  ) {}

  get() {
    return this.repo.get();
  }

  /** Parses `workingDays` ("0,1,2,3,4,5,6") into a Set of weekday numbers. */
  getWorkingDaysSet(): Set<number> {
    const settings = this.repo.get();
    return new Set(
      settings.workingDays
        .split(',')
        .map((d) => Number(d.trim()))
        .filter((d) => !Number.isNaN(d)),
    );
  }

  update(dto: UpdateClinicSettingsDto) {
    if (dto.workingDays !== undefined) {
      const days = dto.workingDays
        .split(',')
        .map((d) => Number(d.trim()))
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      dto.workingDays = [...new Set(days)].sort().join(',');
    }
    return this.repo.update(dto);
  }

  saveLogo(file: Express.Multer.File) {
    const settings = this.repo.get();
    if (settings.logoPath) {
      this.uploads.deleteManagedFile(settings.logoPath);
    }
    const dir = this.uploads.clinicUploadsDir();
    const fileName = this.uploads.safeFileName(file.originalname);
    fs.writeFileSync(path.join(dir, fileName), file.buffer);
    const relativePath = path.join('clinic', fileName);
    return this.repo.update({ logoPath: relativePath, logoOriginalName: file.originalname });
  }

  getLogoAbsolutePath(): string {
    const settings = this.repo.get();
    if (!settings.logoPath) throw new NotFoundException('No logo uploaded');
    const absolute = this.uploads.resolveManagedPath(settings.logoPath);
    if (!absolute || !fs.existsSync(absolute)) throw new NotFoundException('Logo file not found');
    return absolute;
  }
}
