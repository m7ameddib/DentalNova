import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class VoidAccountDiscountDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reason!: string;
}
