import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class OfflineActivateDto {
  @IsString()
  @IsNotEmpty()
  installationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  activationCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clinicName?: string;
}

export class CreateOfflineLicenseSlotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  clinicId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clinicName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  installationId?: string;

  @IsOptional()
  @IsString()
  licenseExpiresAt?: string;

  @IsOptional()
  @IsString()
  slotExpiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNotes?: string;
}
