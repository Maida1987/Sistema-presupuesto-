import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ProductsModule } from './modules/products/products.module';
import { PricingRulesModule } from './modules/pricing-rules/pricing-rules.module';
import { PriceListsModule } from './modules/price-lists/price-lists.module';
import { DeliveryNotesModule } from './modules/delivery-notes/delivery-notes.module';
import { DocumentCountersModule } from './modules/document-counters/document-counters.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CustomersModule,
    SuppliersModule,
    ProductsModule,
    PricingRulesModule,
    PriceListsModule,
    DeliveryNotesModule,
    DocumentCountersModule,
  ],
})
export class AppModule {}
