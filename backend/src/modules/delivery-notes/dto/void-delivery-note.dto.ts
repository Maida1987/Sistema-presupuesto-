import { IsString, MinLength } from 'class-validator';

export class VoidDeliveryNoteDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
