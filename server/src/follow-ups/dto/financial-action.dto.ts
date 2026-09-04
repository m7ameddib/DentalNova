import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FollowUpResult } from '../../common/types';

const FINANCIAL_RESULTS: FollowUpResult[] = [
  'REMINDER_SENT',
  'PROMISED_PAYMENT',
  'PAID_INSTALLMENT',
  'NO_ANSWER',
  'SETTLED',
];

export class FollowUpPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MinLength(1)
  method!: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class FinancialActionDto {
  @IsIn(FINANCIAL_RESULTS)
  result!: FollowUpResult;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FollowUpPaymentDto)
  payment?: FollowUpPaymentDto;
}
