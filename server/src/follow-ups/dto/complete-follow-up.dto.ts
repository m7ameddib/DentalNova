import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { FollowUpResult } from '../../common/types';
import { FollowUpAppointmentDto } from './follow-up-appointment.dto';

const RESULTS: FollowUpResult[] = [
  'FINE',
  'PAIN',
  'SWELLING',
  'NEEDS_APPOINTMENT',
  'NO_ANSWER',
  'FOLLOWED_UP',
  'PAID',
  'CUSTOM',
  'REMINDER_SENT',
  'PROMISED_PAYMENT',
  'PAID_INSTALLMENT',
  'SETTLED',
];

export class CompleteFollowUpDto {
  @IsIn(RESULTS)
  result!: FollowUpResult;

  @IsOptional()
  @IsString()
  note?: string;

  /** Required when result is NO_ANSWER or when rescheduling. */
  @IsOptional()
  @IsDateString()
  nextFollowUpDate?: string;

  @IsOptional()
  @IsBoolean()
  reschedule?: boolean;

  /** Inline appointment booking when result is NEEDS_APPOINTMENT. */
  @IsOptional()
  @ValidateNested()
  @Type(() => FollowUpAppointmentDto)
  appointment?: FollowUpAppointmentDto;
}
