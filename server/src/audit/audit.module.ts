import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLogRepository } from '../database/repositories/audit-log.repository';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditLogRepository],
  exports: [AuditService],
})
export class AuditModule {}
