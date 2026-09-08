import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MinLength, ValidateNested } from 'class-validator';

export class BulkMatchItem {
  @IsString()
  @MinLength(1)
  referenceId!: string;

  @IsString()
  @MinLength(1)
  productId!: string;
}

export class BulkMatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkMatchItem)
  items!: BulkMatchItem[];
}
