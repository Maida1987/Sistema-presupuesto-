import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class CreateSettlementDto {
  @IsString()
  @MinLength(1)
  customerId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  deliveryNoteItemIds!: string[];
}
