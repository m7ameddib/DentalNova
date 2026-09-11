import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

export class AiProviderMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  content!: string;
}

export class AiProviderGenerateDto {
  @IsString()
  systemPrompt!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiProviderMessageDto)
  messages!: AiProviderMessageDto[];

  @IsOptional()
  @IsString()
  imageBase64?: string;

  @IsOptional()
  @IsString()
  imageMimeType?: string;
}
