import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [ProductsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
