import { IsDateString, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { FollowUpType } from '../../common/types';

export class CreateFollowUpDto {
  @IsInt()
  patientId!: number;

  @IsIn(['CLINICAL'])
  type!: FollowUpType;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsDateString()
  followUpDate!: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
