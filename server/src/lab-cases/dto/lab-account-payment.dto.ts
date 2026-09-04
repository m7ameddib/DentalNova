import { IsNumber, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export class RecordLabAccountPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paymentDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateLabAccountPaymentDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paymentDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class VoidLabAccountPaymentDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
