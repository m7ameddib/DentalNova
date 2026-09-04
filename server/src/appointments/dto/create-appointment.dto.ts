import { IsIn, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateAppointmentDto {
  @IsOptional()
  @IsInt()
  patientId?: number;

  /** Used only when patientId is not provided — a quick booking for someone without a Patient Record yet. */
  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  guestPhone?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'time must be in HH:mm format' })
  time!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMin?: number;

  @IsOptional()
  @IsString()
  appointmentType?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** When true, allows booking outside configured working hours (requires permission). */
  @IsOptional()
  allowOutsideHours?: boolean;
}

export class UpdateAppointmentStatusDto {
  @IsIn(['SCHEDULED', 'WAITING', 'IN_TREATMENT', 'COMPLETED', 'CANCELLED'])
  status!: 'SCHEDULED' | 'WAITING' | 'IN_TREATMENT' | 'COMPLETED' | 'CANCELLED';
}

export class LinkAppointmentPatientDto {
  @IsInt()
  patientId!: number;
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsInt()
  patientId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'time must be in HH:mm format' })
  time?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMin?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  appointmentType?: string;

  /** Walk-in appointments only — updates guest contact info. */
  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  guestPhone?: string;

  @IsOptional()
  allowOutsideHours?: boolean;
}
