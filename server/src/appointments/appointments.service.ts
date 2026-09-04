import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentsRepository } from '../database/repositories/appointments.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { WorkingScheduleService } from '../settings/working-schedule.service';
import { AuditService } from '../audit/audit.service';
import { PERMISSIONS } from '../common/rbac.constants';
import {
  CreateAppointmentDto,
  LinkAppointmentPatientDto,
  UpdateAppointmentDto,
  UpdateAppointmentStatusDto,
} from './dto/create-appointment.dto';
import { AuthenticatedUser } from '../auth/auth.types';

export const SLOT_STEP_MIN = 30;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly appointmentsRepo: AppointmentsRepository,
    private readonly patientsRepo: PatientsRepository,
    private readonly workingSchedule: WorkingScheduleService,
    private readonly audit: AuditService,
  ) {}

  getMonthOverview(yearMonth: string) {
    return this.appointmentsRepo.countByMonth(yearMonth);
  }

  getDaySchedule(date: string) {
    const appointments = this.appointmentsRepo.findByDate(date);
    const resolved = this.workingSchedule.resolveForDate(date);
    const slotDefs = this.workingSchedule.buildSlotsForDate(date);
    const bookedTimes = new Set(appointments.map((a: { time: string }) => a.time));
    const enrichedAppointments = appointments.map((a: any) => ({
      ...a,
      outsideWorkingHours: !this.workingSchedule.isWithinWorkingHours(
        date,
        a.time,
        a.durationMin ?? 30,
      ),
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

  create(dto: CreateAppointmentDto, currentUser: AuthenticatedUser) {
    let patientId: number | null = null;
    let guestName: string | null = null;
    let guestPhone: string | null = null;

    if (dto.patientId) {
      const patient = this.patientsRepo.findById(dto.patientId);
      if (!patient) throw new NotFoundException('Patient not found');
      patientId = dto.patientId;
    } else if (dto.guestName?.trim() && dto.guestPhone?.trim()) {
      guestName = dto.guestName.trim();
      guestPhone = dto.guestPhone.trim();
    } else {
      throw new ConflictException('Select a patient, or provide a name and phone number');
    }

    const durationMin = dto.durationMin ?? 30;
    if (this.hasOverlap(dto.date, dto.time, durationMin)) {
      throw new ConflictException('This time overlaps with another appointment');
    }

    if (dto.appointmentType !== 'EMERGENCY') {
      this.assertWorkingHours(dto.date, dto.time, durationMin, dto.allowOutsideHours, currentUser);
    }

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

  private hasOverlap(date: string, time: string, durationMin: number, excludeId?: number): boolean {
    const newStart = this.toMinutes(time);
    const newEnd = newStart + durationMin;
    const existing = this.appointmentsRepo.findActiveByDate(date);
    return existing.some((a: any) => {
      if (excludeId && a.id === excludeId) return false;
      if (a.appointmentType === 'EMERGENCY') return false;
      const start = this.toMinutes(a.time);
      const end = start + (a.durationMin ?? 30);
      return newStart < end && start < newEnd;
    });
  }

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  updateStatus(id: number, dto: UpdateAppointmentStatusDto, currentUser?: AuthenticatedUser) {
    const existing = this.appointmentsRepo.findById(id);
    const updated = this.appointmentsRepo.updateStatus(id, dto.status);
    if (!updated) throw new NotFoundException('Appointment not found');
    const action =
      dto.status === 'CANCELLED' ? 'APPOINTMENT_CANCELLED' : 'APPOINTMENT_STATUS_CHANGED';
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

  linkPatient(id: number, dto: LinkAppointmentPatientDto) {
    const appointment = this.appointmentsRepo.findById(id);
    if (!appointment) throw new NotFoundException('Appointment not found');
    const patient = this.patientsRepo.findById(dto.patientId);
    if (!patient) throw new NotFoundException('Patient not found');
    return this.appointmentsRepo.linkPatient(id, dto.patientId);
  }

  update(id: number, dto: UpdateAppointmentDto, currentUser?: AuthenticatedUser) {
    const appointment = this.appointmentsRepo.findById(id);
    if (!appointment) throw new NotFoundException('Appointment not found');

    const date = dto.date ?? appointment.date;
    const time = dto.time ?? appointment.time;
    const durationMin = dto.durationMin ?? appointment.durationMin;
    const reason = dto.reason !== undefined ? dto.reason.trim() || null : appointment.reason;

    let patientId: number | null = appointment.patientId;
    let guestName: string | null = appointment.guestName;
    let guestPhone: string | null = appointment.guestPhone;

    if (dto.patientId != null) {
      const patient = this.patientsRepo.findById(dto.patientId);
      if (!patient) throw new NotFoundException('Patient not found');
      patientId = dto.patientId;
      guestName = null;
      guestPhone = null;
    } else if (dto.guestName !== undefined || dto.guestPhone !== undefined) {
      guestName = (dto.guestName !== undefined ? dto.guestName.trim() : appointment.guestName) ?? null;
      guestPhone = (dto.guestPhone !== undefined ? dto.guestPhone.trim() : appointment.guestPhone) ?? null;
      if (!guestName || !guestPhone) {
        throw new ConflictException('Walk-in appointments require a name and phone number');
      }
      patientId = null;
    }

    if (this.hasOverlap(date, time, durationMin, id)) {
      throw new ConflictException('This time overlaps with another appointment');
    }

    if (currentUser) {
      this.assertWorkingHours(date, time, durationMin, dto.allowOutsideHours, currentUser);
    }

    const appointmentType =
      dto.appointmentType !== undefined ? dto.appointmentType : appointment.appointmentType;

    const updated = this.appointmentsRepo.update(id, {
      patientId,
      date,
      time,
      durationMin,
      reason,
      appointmentType,
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
    return this.appointmentsRepo.findDetailedById(updated!.id);
  }

  recordReminderSent(id: number) {
    const appointment = this.appointmentsRepo.findById(id);
    if (!appointment) throw new NotFoundException('Appointment not found');
    this.appointmentsRepo.recordReminderSent(id);
    return this.appointmentsRepo.findDetailedById(id);
  }

  private assertWorkingHours(
    date: string,
    time: string,
    durationMin: number,
    allowOutsideHours: boolean | undefined,
    user: AuthenticatedUser,
  ) {
    if (this.workingSchedule.isWithinWorkingHours(date, time, durationMin)) return;
    if (allowOutsideHours) {
      if (!user.permissions.includes(PERMISSIONS.APPOINTMENTS_BOOK_OUTSIDE_HOURS)) {
        throw new ForbiddenException('Not allowed to book outside working hours');
      }
      return;
    }
    throw new ConflictException({
      message: "This appointment is outside the clinic's working hours",
      code: 'OUTSIDE_WORKING_HOURS',
    });
  }
}
