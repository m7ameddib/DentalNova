import { IsBoolean, IsHexColor, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateIf } from 'class-validator';
import { TREATMENT_CATEGORY_ORDER } from '../../common/treatment-catalog.constants';

export class UpdateTreatmentTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  abbreviation?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultPrice?: number;

  @IsOptional()
  @IsIn([...TREATMENT_CATEGORY_ORDER])
  category?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  @Min(0)
  referencePrice?: number | null;

  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  followUp1Days?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  followUp2Days?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  followUp3Days?: number | null;

  @IsOptional()
  @IsIn(['SINGLE', 'UPPER_JAW', 'LOWER_JAW', 'ALL_TEETH'])
  scope?: 'SINGLE' | 'UPPER_JAW' | 'LOWER_JAW' | 'ALL_TEETH';
}
