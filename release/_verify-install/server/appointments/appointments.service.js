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
exports.AppointmentsService = exports.SLOT_STEP_MIN = void 0;
const common_1 = require("@nestjs/common");
const appointments_repository_1 = require("../database/repositories/appointments.repository");
const patients_repository_1 = require("../database/repositories/patients.repository");
const working_schedule_service_1 = require("../settings/working-schedule.service");
const audit_service_1 = require("../audit/audit.service");
const rbac_constants_1 = require("../common/rbac.constants");
exports.SLOT_STEP_MIN = 30;
let AppointmentsService = class AppointmentsService {
    constructor(appointmentsRepo, patientsRepo, workingSchedule, audit) {
        this.appointmentsRepo = appointmentsRepo;
        this.patientsRepo = patientsRepo;
        this.workingSchedule = workingSchedule;
        this.audit = audit;
    }
    getMonthOverview(yearMonth) {
        return this.appointmentsRepo.countByMonth(yearMonth);
    }
    getDaySchedule(date) {
        const appointments = this.appointmentsRepo.findByDate(date);
        const resolved = this.workingSchedule.resolveForDate(date);
        const slotDefs = this.workingSchedule.buildSlotsForDate(date);
        const bookedTimes = new Set(appointments.map((a) => a.time));
        const enrichedAppointments = appointments.map((a) => ({
            ...a,
            outsideWorkingHours: !this.workingSchedule.isWithinWorkingHours(date, a.time, a.durationMin ?? 30),
        }));
        return {
            date,
            isWorkingDay: !resolved.isClosed,
            isClosed: resolved.isClosed,
            isException: resolved.isException,
            exceptionNote: resolved.exceptionNote,
            slots: slotDefs.map((s) => ({
                time: s.time,
                booked: bookedTimes.has(s.time),
                withinWorkingHours: s.withinWorkingHours,
            })),
            appointments: enrichedAppointments,
        };
    }
    create(dto, currentUser) {
        let patientId = null;
        let guestName = null;
        let guestPhone = null;
        if (dto.patientId) {
            const patient = this.patientsRepo.findById(dto.patientId);
            if (!patient)
                throw new common_1.NotFoundException('Patient not found');
            patientId = dto.patientId;
        }
        else if (dto.guestName?.trim() && dto.guestPhone?.trim()) {
            guestName = dto.guestName.trim();
            guestPhone = dto.guestPhone.trim();
        }
        else {
            throw new common_1.ConflictException('Select a patient, or provide a name and phone number');
        }
        const durationMin = dto.durationMin ?? 30;
        if (this.hasOverlap(dto.date, dto.time, durationMin)) {
            throw new common_1.ConflictException('This time overlaps with another appointment');
        }
        this.assertWorkingHours(dto.date, dto.time, durationMin, dto.allowOutsideHours, currentUser);
        const created = this.appointmentsRepo.create({
            patientId,
            guestName,
            guestPhone,
            date: dto.date,
            time: dto.time,
            durationMin,
            appointmentType: dto.appointmentType,
            reason: dto.reason,
            notes: dto.notes,
            createdById: currentUser.id,
        });
        this.audit.log({
            action: 'APPOINTMENT_CREATED',
            entityType: 'appointment',
            entityId: created.id,
            patientId: patientId ?? undefined,
            description: `Appointment ${dto.date} ${dto.time}`,
            userId: currentUser.id,
        });
        return created;
    }
    hasOverlap(date, time, durationMin, excludeId) {
        const newStart = this.toMinutes(time);
        const newEnd = newStart + durationMin;
        const existing = this.appointmentsRepo.findActiveByDate(date);
        return existing.some((a) => {
            if (excludeId && a.id === excludeId)
                return false;
            const start = this.toMinutes(a.time);
            const end = start + (a.durationMin ?? 30);
            return newStart < end && start < newEnd;
        });
    }
    toMinutes(time) {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    }
    updateStatus(id, dto, currentUser) {
        const existing = this.appointmentsRepo.findById(id);
        const updated = this.appointmentsRepo.updateStatus(id, dto.status);
        if (!updated)
            throw new common_1.NotFoundException('Appointment not found');
        const action = dto.status === 'CANCELLED' ? 'APPOINTMENT_CANCELLED' : 'APPOINTMENT_STATUS_CHANGED';
        this.audit.log({
            action,
            entityType: 'appointment',
            entityId: id,
            patientId: existing?.patientId ?? undefined,
            description: `Appointment status: ${existing?.status ?? '?'} → ${dto.status}`,
            userId: currentUser?.id ?? null,
        });
        return updated;
    }
    linkPatient(id, dto) {
        const appointment = this.appointmentsRepo.findById(id);
        if (!appointment)
            throw new common_1.NotFoundException('Appointment not found');
        const patient = this.patientsRepo.findById(dto.patientId);
        if (!patient)
            throw new common_1.NotFoundException('Patient not found');
        return this.appointmentsRepo.linkPatient(id, dto.patientId);
    }
    update(id, dto, currentUser) {
        const appointment = this.appointmentsRepo.findById(id);
        if (!appointment)
            throw new common_1.NotFoundException('Appointment not found');
        const date = dto.date ?? appointment.date;
        const time = dto.time ?? appointment.time;
        const durationMin = dto.durationMin ?? appointment.durationMin;
        const reason = dto.reason !== undefined ? dto.reason.trim() || null : appointment.reason;
        let patientId = appointment.patientId;
        let guestName = appointment.guestName;
        let guestPhone = appointment.guestPhone;
        if (dto.patientId != null) {
            const patient = this.patientsRepo.findById(dto.patientId);
            if (!patient)
                throw new common_1.NotFoundException('Patient not found');
            patientId = dto.patientId;
            guestName = null;
            guestPhone = null;
        }
        else if (dto.guestName !== undefined || dto.guestPhone !== undefined) {
            guestName = (dto.guestName !== undefined ? dto.guestName.trim() : appointment.guestName) ?? null;
            guestPhone = (dto.guestPhone !== undefined ? dto.guestPhone.trim() : appointment.guestPhone) ?? null;
            if (!guestName || !guestPhone) {
                throw new common_1.ConflictException('Walk-in appointments require a name and phone number');
            }
            patientId = null;
        }
        if (this.hasOverlap(date, time, durationMin, id)) {
            throw new common_1.ConflictException('This time overlaps with another appointment');
        }
        if (currentUser) {
            this.assertWorkingHours(date, time, durationMin, dto.allowOutsideHours, currentUser);
        }
        const updated = this.appointmentsRepo.update(id, {
            patientId,
            date,
            time,
            durationMin,
            reason,
            guestName,
            guestPhone,
        });
        this.audit.log({
            action: 'APPOINTMENT_EDITED',
            entityType: 'appointment',
            entityId: id,
            patientId: patientId ?? undefined,
            description: `Appointment edited: ${date} ${time}`,
            userId: currentUser?.id ?? null,
        });
        return this.appointmentsRepo.findDetailedById(updated.id);
    }
    recordReminderSent(id) {
        const appointment = this.appointmentsRepo.findById(id);
        if (!appointment)
            throw new common_1.NotFoundException('Appointment not found');
        this.appointmentsRepo.recordReminderSent(id);
        return this.appointmentsRepo.findDetailedById(id);
    }
    assertWorkingHours(date, time, durationMin, allowOutsideHours, user) {
        if (this.workingSchedule.isWithinWorkingHours(date, time, durationMin))
            return;
        if (allowOutsideHours) {
            if (!user.permissions.includes(rbac_constants_1.PERMISSIONS.APPOINTMENTS_BOOK_OUTSIDE_HOURS)) {
                throw new common_1.ForbiddenException('Not allowed to book outside working hours');
            }
            return;
        }
        throw new common_1.ConflictException({
            message: "This appointment is outside the clinic's working hours",
            code: 'OUTSIDE_WORKING_HOURS',
        });
    }
};
exports.AppointmentsService = AppointmentsService;
exports.AppointmentsService = AppointmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [appointments_repository_1.AppointmentsRepository,
        patients_repository_1.PatientsRepository,
        working_schedule_service_1.WorkingScheduleService,
        audit_service_1.AuditService])
], AppointmentsService);
//# sourceMappingURL=appointments.service.js.map