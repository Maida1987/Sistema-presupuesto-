import { IsString, MinLength } from 'class-validator';

export class CreateSupplierReferenceDto {
  @IsString()
  @MinLength(1)
  supplierId!: string;

  @IsString()
  @MinLength(1)
  supplierCode!: string;

  @IsString()
  @MinLength(1)
  supplierDescription!: string;
}
