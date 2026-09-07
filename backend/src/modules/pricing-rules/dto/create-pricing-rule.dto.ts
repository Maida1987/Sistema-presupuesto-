import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePricingRuleDto {
  @IsIn(['GLOBAL', 'CATEGORY', 'SUPPLIER', 'PRODUCT'])
  scope!: 'GLOBAL' | 'CATEGORY' | 'SUPPLIER' | 'PRODUCT';

  @IsOptional()
  @IsString()
  scopeRefId?: string;

  @IsNumber()
  @Min(0)
  @Max(10)
  marginPct!: number;

  @IsEnum(['COST', 'SALE_PRICE'])
  marginBase!: 'COST' | 'SALE_PRICE';

  @IsOptional() @IsNumber() @Min(0) @Max(10) expensesPct?: number;
  @IsOptional() @IsNumber() @Min(0) expensesFixed?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  ivaPct!: number;

  @IsIn(['NONE', 'NEAREST_1', 'NEAREST_10', 'NEAREST_100', 'CEIL_10', 'CEIL_100'])
  roundingRule!: string;
}
