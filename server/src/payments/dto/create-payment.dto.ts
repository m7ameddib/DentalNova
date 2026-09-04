import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  patientId!: number;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  /** Payment method code, e.g. "CASH" — validated against the editable Payment Methods list. */
  @IsString()
  @IsNotEmpty()
  method!: string;

  /** ISO date string (YYYY-MM-DD). Defaults to today when omitted. */
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
