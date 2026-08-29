import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  internalCode!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() truckApplication?: string;
  @IsOptional() @IsString() notes?: string;
}
