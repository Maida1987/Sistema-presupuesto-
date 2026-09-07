import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, MinLength, ValidateNested } from 'class-validator';

export class DeliveryNoteItemInput {
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateDeliveryNoteDto {
  @IsString()
  @MinLength(1)
  customerId!: string;

  @IsOptional()
  @IsString()
  series?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeliveryNoteItemInput)
  items!: DeliveryNoteItemInput[];
}
