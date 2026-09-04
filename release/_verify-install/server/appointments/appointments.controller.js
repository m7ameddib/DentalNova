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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const rbac_constants_1 = require("../common/rbac.constants");
const appointments_service_1 = require("./appointments.service");
const create_appointment_dto_1 = require("./dto/create-appointment.dto");
let AppointmentsController = class AppointmentsController {
    constructor(appointmentsService) {
        this.appointmentsService = appointmentsService;
    }
    monthOverview(yearMonth) {
        return this.appointmentsService.getMonthOverview(yearMonth);
    }
    daySchedule(date) {
        return this.appointmentsService.getDaySchedule(date);
    }
    create(dto, user) {
        return this.appointmentsService.create(dto, user);
    }
    updateStatus(id, dto, user) {
        return this.appointmentsService.updateStatus(id, dto, user);
    }
    update(id, dto, user) {
        return this.appointmentsService.update(id, dto, user);
    }
    recordReminderSent(id) {
        return this.appointmentsService.recordReminderSent(id);
    }
    linkPatient(id, dto) {
        return this.appointmentsService.linkPatient(id, dto);
    }
};
exports.AppointmentsController = AppointmentsController;
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.APPOINTMENTS_VIEW),
    (0, common_1.Get)('month'),
    __param(0, (0, common_1.Query)('yearMonth')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "monthOverview", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.APPOINTMENTS_VIEW),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "daySchedule", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.APPOINTMENTS_CREATE),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_appointment_dto_1.CreateAppointmentDto, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "create", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.APPOINTMENTS_EDIT),
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, create_appointment_dto_1.UpdateAppointmentStatusDto, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "updateStatus", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.APPOINTMENTS_EDIT),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, create_appointment_dto_1.UpdateAppointmentDto, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "update", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.APPOINTMENTS_EDIT),
    (0, common_1.Patch)(':id/reminder-sent'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "recordReminderSent", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.APPOINTMENTS_EDIT),
    (0, common_1.Patch)(':id/link-patient'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, create_appointment_dto_1.LinkAppointmentPatientDto]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "linkPatient", null);
exports.AppointmentsController = AppointmentsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('appointments'),
    __metadata("design:paramtypes", [appointments_service_1.AppointmentsService])
], AppointmentsController);
//# sourceMappingURL=appointments.controller.js.map