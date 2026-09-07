import { IsString, MinLength } from 'class-validator';

export class VoidSettlementDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
