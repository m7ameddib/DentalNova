import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAreaDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
