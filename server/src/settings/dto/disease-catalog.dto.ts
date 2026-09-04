import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDiseaseCatalogDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateDiseaseCatalogDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
