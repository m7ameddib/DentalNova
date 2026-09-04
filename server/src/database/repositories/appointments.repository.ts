import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { Appointment, AppointmentStatus } from '../../common/types';

export interface CreateAppointmentInput {
  patientId?: number | null;
  guestName?: string | null;
  guestPhone?: string | null;
  date: string;
  time: string;
  durationMin?: number;
  appointmentType?: string;
  reason?: string | null;
  notes?: string | null;
  createdById?: number | null;
}

@Injectable()
export class AppointmentsRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): Appointment | undefined {
    const row = this.db.connection
      .prepare('SELECT * FROM appointments WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? toCamel<Appointment>(row) : undefined;
  }

  /**
   * A patient's appointments. When `upcomingOnly` is set, only active
   * (not completed/cancelled) appointments that have not already passed —
   * today's appointments whose time has already gone by are excluded too.
   */
  findByPatient(patientId: number, upcomingOnly = false, limit = 20): Appointment[] {
    const query = upcomingOnly
      ? `SELECT * FROM appointments
         WHERE patient_id = ?
           AND status NOT IN ('COMPLETED', 'CANCELLED')
           AND (
             status IN ('WAITING', 'IN_TREATMENT')
             OR date(date) > date('now')
             OR (date(date) = date('now') AND time >= strftime('%H:%M', 'now'))
           )
         ORDER BY date ASC, time ASC LIMIT ?`
      : `SELECT * FROM appointments WHERE patient_id = ? ORDER BY date DESC, time DESC LIMIT ?`;
    const rows = this.db.connection.prepare(query).all(patientId, limit) as Record<
      string,
      unknown
    >[];
    return toCamelList<Appointment>(rows);
  }

  /** Appointment counts per date for a given month — used to mark days on the calendar. */
  countByMonth(yearMonth: string): { date: string; count: number }[] {
    const rows = this.db.connection
      .prepare(
        `SELECT date, COUNT(*) as count
         FROM appointments
         WHERE date LIKE ? AND status != 'CANCELLED'
         GROUP BY date`,
      )
      .all(`${yearMonth}%`) as { date: string; count: number }[];
    return rows;
  }

  findByDate(date: string): Appointment[] {
    const rows = this.db.connection
      .prepare(
        `SELECT a.*,
                COALESCE(p.full_name, a.guest_name) as patient_name,
                p.file_number as patient_file_number,
                p.phone as patient_phone
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE a.date = ?
         ORDER BY a.time ASC`,
      )
      .all(date) as Record<string, unknown>[];
    return toCamelList(rows);
  }

  /** Active (non-cancelled) appointments for overlap checks when booking/editing. */
  findActiveByDate(date: string): Appointment[] {
    const rows = this.db.connection
      .prepare(
        `SELECT a.*,
                COALESCE(p.full_name, a.guest_name) as patient_name,
                p.file_number as patient_file_number,
                p.phone as patient_phone
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE a.date = ? AND a.status != 'CANCELLED'
         ORDER BY a.time ASC`,
      )
      .all(date) as Record<string, unknown>[];
    return toCamelList(rows);
  }

  findDetailedById(id: number): Appointment | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT a.*,
                COALESCE(p.full_name, a.guest_name) as patient_name,
                p.file_number as patient_file_number,
                p.phone as patient_phone
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE a.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? toCamel<Appointment>(row) : undefined;
  }

  create(input: CreateAppointmentInput): Appointment {
    const result = this.db.connection
      .prepare(
        `INSERT INTO appointments
          (patient_id, guest_name, guest_phone, date, time, duration_min, appointment_type, reason, notes, created_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.patientId ?? null,
        input.guestName ?? null,
        input.guestPhone ?? null,
        input.date,
        input.time,
        input.durationMin ?? 30,
        input.appointmentType ?? 'CHECKUP',
        input.reason ?? null,
        input.notes ?? null,
        input.createdById ?? null,
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }

  updateStatus(id: number, status: AppointmentStatus): Appointment | undefined {
    this.db.connection
      .prepare(`UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(status, id);
    return this.findById(id);
  }

  /** Links a walk-in appointment to a real Patient Record and clears guest fields. */
  linkPatient(id: number, patientId: number): Appointment | undefined {
    this.db.connection
      .prepare(
        `UPDATE appointments SET patient_id = ?, guest_name = NULL, guest_phone = NULL, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(patientId, id);
    return this.findById(id);
  }

  update(
    id: number,
    input: {
      patientId?: number | null;
      date?: string;
      time?: string;
      durationMin?: number;
      reason?: string | null;
      appointmentType?: string;
      guestName?: string | null;
      guestPhone?: string | null;
    },
  ): Appointment | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const patientId = input.patientId !== undefined ? input.patientId : existing.patientId;
    const date = input.date ?? existing.date;
    const time = input.time ?? existing.time;
    const durationMin = input.durationMin ?? existing.durationMin;
    const reason = input.reason !== undefined ? input.reason : existing.reason;
    const appointmentType =
      input.appointmentType !== undefined ? input.appointmentType : existing.appointmentType;
    const guestName =
      patientId != null ? null : input.guestName !== undefined ? input.guestName : existing.guestName;
    const guestPhone =
      patientId != null ? null : input.guestPhone !== undefined ? input.guestPhone : existing.guestPhone;

    this.db.connection
      .prepare(
        `UPDATE appointments
         SET patient_id = ?, date = ?, time = ?, duration_min = ?, reason = ?, appointment_type = ?,
             guest_name = ?, guest_phone = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(patientId, date, time, durationMin, reason, appointmentType, guestName, guestPhone, id);
    return this.findById(id);
  }

  recordReminderSent(id: number): Appointment | undefined {
    this.db.connection
      .prepare(
        `UPDATE appointments SET reminder_sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      )
      .run(id);
    return this.findById(id);
  }

  /**
   * Appointments within a date range for the Reports drill-down. Unlike
   * `findByDate`, CANCELLED appointments are included here since the
   * Appointments Summary "Cancelled" card must be able to show them.
   */
  findForPeriodDetailed(fromIso: string, toIso: string, status?: AppointmentStatus): Appointment[] {
    const rows = this.db.connection
      .prepare(
        `SELECT a.*,
                COALESCE(p.full_name, a.guest_name) as patient_name,
                p.file_number as patient_file_number,
                p.phone as patient_phone
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE date(a.date) BETWEEN date(?) AND date(?)
           ${status ? 'AND a.status = ?' : ''}
         ORDER BY a.date ASC, a.time ASC`,
      )
      .all(...(status ? [fromIso, toIso, status] : [fromIso, toIso])) as Record<string, unknown>[];
    return toCamelList(rows);
  }

  /** Appointment counts by status within a date range (Reports > Appointments Summary). */
  countByStatusForPeriod(fromIso: string, toIso: string): { status: AppointmentStatus; count: number }[] {
    const rows = this.db.connection
      .prepare(
        `SELECT status, COUNT(*) as count FROM appointments
         WHERE date(date) BETWEEN date(?) AND date(?)
         GROUP BY status`,
      )
      .all(fromIso, toIso) as { status: AppointmentStatus; count: number }[];
    return rows;
  }
}
