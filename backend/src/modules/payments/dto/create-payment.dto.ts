import { IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @MinLength(1)
  customerId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @MinLength(1)
  paymentMethodId!: string;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
