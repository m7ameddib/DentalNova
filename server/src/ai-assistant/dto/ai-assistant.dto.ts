import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AiChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class AiChatDto {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  history?: AiChatMessageDto[];

  @IsOptional()
  @IsString()
  imageBase64?: string;

  @IsOptional()
  @IsString()
  imageMimeType?: string;

  /** Client-side timestamp (Date.now()) for network latency measurement. */
  @IsOptional()
  @IsNumber()
  clientSentAt?: number;
}

export class AiExecuteActionDto {
  @IsString()
  @IsNotEmpty()
  action!: string;

  @IsObject()
  params!: Record<string, unknown>;
}
