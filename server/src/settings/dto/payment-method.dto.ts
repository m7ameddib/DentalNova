import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  @MinLength(1)
  label!: string;
}

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
