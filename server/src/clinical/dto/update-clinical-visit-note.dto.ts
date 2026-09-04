import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateClinicalVisitNoteDto {
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  examinationFindings?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  procedureAction?: string;

  @IsOptional()
  @IsString()
  anesthesiaNote?: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @IsOptional()
  @IsString()
  patientInstructions?: string;
}
