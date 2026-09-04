import { IsNumber, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export class RecordLabPaymentDto {
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

export class VoidLabPaymentDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
