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
import { AccountsModule } from './modules/accounts/accounts.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SearchModule } from './modules/search/search.module';
import { AuditQueryModule } from './modules/audit/audit-query.module';
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
    AccountsModule,
    PaymentsModule,
    DashboardModule,
    SearchModule,
    AuditQueryModule,
    DocumentCountersModule,
  ],
})
export class AppModule {}
