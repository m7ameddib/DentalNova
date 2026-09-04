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
exports.LabWorkTypesRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database.service");
const row_mapper_util_1 = require("../row-mapper.util");
let LabWorkTypesRepository = class LabWorkTypesRepository {
    constructor(db) {
        this.db = db;
    }
    findAllActive() {
        const rows = this.db.connection
            .prepare('SELECT * FROM lab_work_types WHERE is_active = 1 ORDER BY sort_order, label')
            .all();
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    findByCode(code) {
        const row = this.db.connection
            .prepare('SELECT * FROM lab_work_types WHERE code = ?')
            .get(code);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
};
exports.LabWorkTypesRepository = LabWorkTypesRepository;
exports.LabWorkTypesRepository = LabWorkTypesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], LabWorkTypesRepository);
//# sourceMappingURL=lab-work-types.repository.js.map