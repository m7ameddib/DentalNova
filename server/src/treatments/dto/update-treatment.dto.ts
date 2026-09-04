import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTreatmentDto {
  @IsOptional()
  @IsInt()
  treatmentTypeId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  teeth?: number[];

  @IsOptional()
  @IsString()
  treatmentDate?: string;

  @IsOptional()
  @IsIn(['SINGLE', 'UPPER_JAW', 'LOWER_JAW', 'ALL_TEETH'])
  treatmentScope?: 'SINGLE' | 'UPPER_JAW' | 'LOWER_JAW' | 'ALL_TEETH';

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'VOID'])
  status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VOID';

  @IsOptional()
  @IsString()
  note?: string;
}
