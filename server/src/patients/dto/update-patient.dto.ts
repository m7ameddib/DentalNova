import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePatientDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender?: string;

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsInt()
  guarantorId?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accountDiscount?: number;
}
