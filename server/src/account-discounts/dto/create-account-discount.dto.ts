import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAccountDiscountDto {
  @IsInt()
  patientId!: number;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
