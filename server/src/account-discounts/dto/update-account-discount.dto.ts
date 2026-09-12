import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateAccountDiscountDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
