import { IsString, MinLength } from 'class-validator';

export class PreviewImportDto {
  @IsString()
  @MinLength(1)
  supplierId!: string;
}
