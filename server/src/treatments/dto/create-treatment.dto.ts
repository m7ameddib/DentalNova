import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateTreatmentDto {
  @IsInt()
  patientId!: number;

  @IsInt()
  treatmentTypeId!: number;

  /**
   * FDI tooth numbers this treatment entry applies to. One entry can cover
   * several teeth (e.g. a filling done on 3 teeth in the same visit) — the
   * base amount is the catalog default price multiplied by the number of
   * teeth selected here.
   */
  @IsArray()
  @IsInt({ each: true })
  teeth!: number[];

  /** Optional discount for the whole entry (currency units, not cents). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED'])
  status!: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  treatmentDate?: string;

  @IsOptional()
  @IsIn(['SINGLE', 'UPPER_JAW', 'LOWER_JAW', 'ALL_TEETH'])
  treatmentScope?: 'SINGLE' | 'UPPER_JAW' | 'LOWER_JAW' | 'ALL_TEETH';
}
