import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

export const PRESCRIPTION_TYPES = ['MEDICATION', 'XRAY'] as const;
export type PrescriptionTypeDto = (typeof PRESCRIPTION_TYPES)[number];

export class PrescriptionItemDto {
  @IsString()
  medicineName!: string;

  @IsOptional()
  @IsString()
  dose?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class CreatePrescriptionDto {
  @IsOptional()
  @IsIn(PRESCRIPTION_TYPES)
  type?: PrescriptionTypeDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items!: PrescriptionItemDto[];
}
