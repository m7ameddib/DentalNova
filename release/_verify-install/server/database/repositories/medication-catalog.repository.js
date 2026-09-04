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
exports.MedicationCatalogRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database.service");
const row_mapper_util_1 = require("../row-mapper.util");
let MedicationCatalogRepository = class MedicationCatalogRepository {
    constructor(db) {
        this.db = db;
    }
    findAll() {
        const rows = this.db.connection
            .prepare('SELECT * FROM medication_catalog ORDER BY category, sort_order, name')
            .all();
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    findById(id) {
        const row = this.db.connection.prepare('SELECT * FROM medication_catalog WHERE id = ?').get(id);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
    nextSortOrder() {
        const row = this.db.connection
            .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM medication_catalog')
            .get();
        return row.maxOrder + 1;
    }
    create(input) {
        const result = this.db.connection
            .prepare(`INSERT INTO medication_catalog
          (name, strength_form, category, default_dose, default_frequency, default_duration, default_instructions, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(input.name, input.strengthForm ?? null, input.category, input.defaultDose ?? null, input.defaultFrequency ?? null, input.defaultDuration ?? null, input.defaultInstructions ?? null, input.sortOrder ?? this.nextSortOrder());
        return this.findById(Number(result.lastInsertRowid));
    }
    delete(id) {
        const result = this.db.connection.prepare('DELETE FROM medication_catalog WHERE id = ?').run(id);
        return result.changes > 0;
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        const name = input.name ?? existing.name;
        const strengthForm = input.strengthForm !== undefined ? input.strengthForm : existing.strengthForm;
        const category = input.category ?? existing.category;
        const defaultDose = input.defaultDose !== undefined ? input.defaultDose : existing.defaultDose;
        const defaultFrequency = input.defaultFrequency !== undefined ? input.defaultFrequency : existing.defaultFrequency;
        const defaultDuration = input.defaultDuration !== undefined ? input.defaultDuration : existing.defaultDuration;
        const defaultInstructions = input.defaultInstructions !== undefined ? input.defaultInstructions : existing.defaultInstructions;
        const sortOrder = input.sortOrder ?? existing.sortOrder;
        const isActive = input.isActive ?? existing.isActive;
        this.db.connection
            .prepare(`UPDATE medication_catalog SET
          name = ?, strength_form = ?, category = ?, default_dose = ?, default_frequency = ?,
          default_duration = ?, default_instructions = ?, sort_order = ?, is_active = ?
         WHERE id = ?`)
            .run(name, strengthForm, category, defaultDose, defaultFrequency, defaultDuration, defaultInstructions, sortOrder, isActive ? 1 : 0, id);
        return this.findById(id);
    }
};
exports.MedicationCatalogRepository = MedicationCatalogRepository;
exports.MedicationCatalogRepository = MedicationCatalogRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], MedicationCatalogRepository);
//# sourceMappingURL=medication-catalog.repository.js.map