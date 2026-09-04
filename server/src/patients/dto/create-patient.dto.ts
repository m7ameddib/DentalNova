import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender?: string;

  /** ISO date string (YYYY-MM-DD). Provide this OR approxAge, not required to have both. */
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  approxAge?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsInt()
  areaId?: number;

  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @IsOptional()
  @IsString()
  generalNotes?: string;

  /**
   * When set, skips the duplicate-phone check and links the new patient to
   * the same family group as the referenced existing patient (creating the
   * group on the fly if it doesn't exist yet). Used by the "Add as family
   * member" confirmation flow.
   */
  @IsOptional()
  @IsInt()
  linkFamilyOfPatientId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsInt()
  guarantorId?: number;
}
