import { IsString, MinLength } from 'class-validator';

export class AddFollowUpNoteDto {
  @IsString()
  @MinLength(1)
  note!: string;
}
