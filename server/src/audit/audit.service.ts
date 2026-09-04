import { Injectable } from '@nestjs/common';
import { AuditLogRepository, CreateAuditLogInput } from '../database/repositories/audit-log.repository';

@Injectable()
export class AuditService {
  constructor(private readonly repo: AuditLogRepository) {}

  log(input: CreateAuditLogInput) {
    return this.repo.create(input);
  }

  forPatient(patientId: number, limit = 100) {
    return this.repo.findByPatient(patientId, limit);
  }

  recent(limit = 200) {
    return this.repo.findRecent(limit);
  }
}
