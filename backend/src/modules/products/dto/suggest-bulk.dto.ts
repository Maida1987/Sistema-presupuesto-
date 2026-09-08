import { ArrayMinSize, ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class SuggestBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  referenceIds!: string[];
}
