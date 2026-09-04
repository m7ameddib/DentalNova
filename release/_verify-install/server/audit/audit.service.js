"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const audit_log_repository_1 = require("../database/repositories/audit-log.repository");
let AuditService = class AuditService {
    constructor(repo) {
        this.repo = repo;
    }
    log(input) {
        return this.repo.create(input);
    }
    forPatient(patientId, limit = 100) {
        return this.repo.findByPatient(patientId, limit);
    }
    recent(limit = 200) {
        return this.repo.findRecent(limit);
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_log_repository_1.AuditLogRepository])
], AuditService);
//# sourceMappingURL=audit.service.js.map