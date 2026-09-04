import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export const ATTACHMENT_CATEGORIES = ['XRAY', 'PHOTO', 'DOCUMENT', 'OTHER'] as const;

export class CreateAttachmentDto {
  @IsIn(ATTACHMENT_CATEGORIES)
  category!: (typeof ATTACHMENT_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patientTreatmentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clinicalVisitNoteId?: number;

  /** Comma-separated tooth numbers, e.g. "11,12,46" */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  teeth?: string;
}
