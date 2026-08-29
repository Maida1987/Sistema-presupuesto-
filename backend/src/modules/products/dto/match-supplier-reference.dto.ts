import { IsString, MinLength } from 'class-validator';

export class MatchSupplierReferenceDto {
  @IsString()
  @MinLength(1)
  productId!: string;
}
