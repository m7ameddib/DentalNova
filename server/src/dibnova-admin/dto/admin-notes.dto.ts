import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminNotesDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  clinicId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class AdminPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clinicId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  paymentDate!: string;

  @IsString()
  @MaxLength(40)
  method!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AdminMarketingTrialDto {
  @IsString()
  @MaxLength(200)
  doctorName!: string;

  @IsString()
  @MaxLength(40)
  phone!: string;
}

export class AdminResetPasswordDto {
  @IsString()
  @MaxLength(64)
  clinicId!: string;

  @Type(() => Number)
  @IsInt()
  userId!: number;

  @IsString()
  @MaxLength(200)
  newPassword!: string;
}
