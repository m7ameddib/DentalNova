import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class ActivateLicenseDto {
  @IsString()
  @IsNotEmpty()
  license!: string;
}

export class FirstSetupDto {
  @IsString()
  @IsNotEmpty()
  clinicName!: string;

  @IsString()
  @IsNotEmpty()
  doctorName!: string;

  @IsString()
  @IsNotEmpty()
  clinicPhone!: string;

  @IsString()
  @IsNotEmpty()
  doctorPhone!: string;

  @IsString()
  @Matches(/^[0-6](,[0-6])*$/)
  workingDays!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  workStartTime!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  workEndTime!: string;

  @IsString()
  @IsNotEmpty()
  adminUsername!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @IsOptional()
  @IsString()
  address?: string;
}
