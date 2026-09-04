import { IsIn } from 'class-validator';

export class UpdateTreatmentStatusDto {
  @IsIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'VOID'])
  status!: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VOID';
}
