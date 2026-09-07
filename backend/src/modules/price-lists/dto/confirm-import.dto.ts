import { IsString, MinLength } from 'class-validator';

export class ConfirmImportDto {
  @IsString()
  @MinLength(1)
  supplierId!: string;

  /** JSON.stringify(ConfirmSheetInput[]) — los formularios multipart no soportan arrays anidados nativamente. */
  @IsString()
  @MinLength(1)
  sheetsJson!: string;
}
