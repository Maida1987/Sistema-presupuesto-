import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  internalCode!: string;

  @IsString()
  @MinLength(1)
  businessName!: string;

  @IsOptional() @IsString() cuit?: string;
  @IsOptional() @IsString() dni?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() commercialCondition?: string;
  @IsOptional() @IsNumber() creditLimit?: number;
  @IsOptional() @IsString() notes?: string;
}
