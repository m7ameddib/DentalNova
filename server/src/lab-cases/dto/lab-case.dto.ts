import {
  IsArray,
  ArrayMinSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { LabCaseStatus } from '../../common/types';

const LAB_STATUSES: LabCaseStatus[] = [
  'PENDING',
  'SENT_TO_LAB',
  'IN_PROGRESS',
  'RECEIVED_FROM_LAB',
  'DELIVERED_TO_PATIENT',
  'CANCELLED',
];

export class CreateLabCaseDto {
  @IsInt()
  patientId!: number;

  @IsOptional()
  @IsInt()
  patientTreatmentId?: number;

  @IsString()
  labName!: string;

  @IsString()
  workTypeCode!: string;

  @IsOptional()
  @IsString()
  workTypeCustom?: string;

  @IsOptional()
  @IsIn(LAB_STATUSES)
  status?: LabCaseStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  sentDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  receivedDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deliveredDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Min(0)
  labCost?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(11, { each: true })
  teeth!: number[];
}

export class UpdateLabCaseDto {
  @IsOptional()
  @IsInt()
  patientTreatmentId?: number | null;

  @IsOptional()
  @IsString()
  labName?: string;

  @IsOptional()
  @IsString()
  workTypeCode?: string;

  @IsOptional()
  @IsString()
  workTypeCustom?: string;

  @IsOptional()
  @IsIn(LAB_STATUSES)
  status?: LabCaseStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  sentDate?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expectedDeliveryDate?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  receivedDate?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deliveredDate?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @Min(0)
  labCost?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  teeth?: number[];
}
