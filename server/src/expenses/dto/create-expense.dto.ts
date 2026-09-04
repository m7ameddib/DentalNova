import { IsInt, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  expenseCategoryId?: number;

  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  paidTo?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsInt()
  expenseCategoryId?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paidTo?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
