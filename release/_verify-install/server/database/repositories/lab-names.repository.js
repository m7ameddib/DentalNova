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
exports.LabNamesRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database.service");
const row_mapper_util_1 = require("../row-mapper.util");
let LabNamesRepository = class LabNamesRepository {
    constructor(db) {
        this.db = db;
    }
    findAllActive() {
        const rows = this.db.connection
            .prepare('SELECT * FROM lab_names WHERE is_active = 1 ORDER BY sort_order, name')
            .all();
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    findAll() {
        const rows = this.db.connection
            .prepare('SELECT * FROM lab_names ORDER BY sort_order, name')
            .all();
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    create(name) {
        const maxOrder = this.db.connection
            .prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM lab_names')
            .get();
        const result = this.db.connection
            .prepare('INSERT INTO lab_names (name, sort_order) VALUES (?, ?)')
            .run(name.trim(), maxOrder.m + 1);
        return this.findById(Number(result.lastInsertRowid));
    }
    findById(id) {
        const row = this.db.connection.prepare('SELECT * FROM lab_names WHERE id = ?').get(id);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        const merged = { ...existing, ...input, name: input.name?.trim() ?? existing.name };
        this.db.connection
            .prepare('UPDATE lab_names SET name = ?, is_active = ?, sort_order = ? WHERE id = ?')
            .run(merged.name, merged.isActive ? 1 : 0, merged.sortOrder, id);
        return this.findById(id);
    }
};
exports.LabNamesRepository = LabNamesRepository;
exports.LabNamesRepository = LabNamesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], LabNamesRepository);
//# sourceMappingURL=lab-names.repository.js.map