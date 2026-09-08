import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BulkIgnoreDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  referenceIds!: string[];
}
