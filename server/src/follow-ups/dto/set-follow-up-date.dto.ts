import { IsDateString, IsOptional, IsString } from 'class-validator';

export class SetFollowUpDateDto {
  @IsDateString()
  followUpDate!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
