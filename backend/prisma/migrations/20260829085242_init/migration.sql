-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');

-- CreateEnum
CREATE TYPE "PriceListStatus" AS ENUM ('PROCESSED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "PricingRuleScope" AS ENUM ('GLOBAL', 'CATEGORY', 'SUPPLIER', 'PRODUCT');

-- CreateEnum
CREATE TYPE "MarginBase" AS ENUM ('COST', 'SALE_PRICE');

-- CreateEnum
CREATE TYPE "PriceSourceType" AS ENUM ('LIST_IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('BORRADOR', 'EMITIDO', 'ENTREGADO', 'FIRMADO', 'LIQUIDADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "DeliveryNoteDocumentType" AS ENUM ('ORIGINAL_PDF', 'DUPLICADO_PDF', 'FIRMADO_SCAN');

-- CreateEnum
CREATE TYPE "AccountMovementType" AS ENUM ('REMITO_PENDIENTE', 'LIQUIDACION', 'PAGO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('BORRADOR', 'CONFIRMADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('REGISTRADO', 'ANULADO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "internal_code" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "cuit" TEXT,
    "dni" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "commercial_condition" TEXT,
    "credit_limit" DECIMAL(14,2),
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuit" TEXT,
    "contact_info" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "internal_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "brand" TEXT,
    "category_id" TEXT,
    "unit" TEXT,
    "truck_application" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_supplier_references" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "supplier_id" TEXT NOT NULL,
    "supplier_code" TEXT NOT NULL,
    "supplier_description" TEXT NOT NULL,
    "match_status" "MatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matched_by" TEXT,
    "matched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_supplier_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_files" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "sha256_hash" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imported_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_mappings" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "column_mapping" JSONB NOT NULL,
    "detected_headers" JSONB,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "imported_file_id" TEXT NOT NULL,
    "sheet_name" TEXT,
    "effective_date" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imported_by" TEXT NOT NULL,
    "status" "PriceListStatus" NOT NULL DEFAULT 'PROCESSED',
    "notes" TEXT,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "supplier_reference_id" TEXT NOT NULL,
    "price" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_errors" (
    "id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_data" JSONB NOT NULL,
    "error_type" TEXT NOT NULL,
    "error_message" TEXT NOT NULL,

    CONSTRAINT "import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "scope" "PricingRuleScope" NOT NULL,
    "scope_ref_id" TEXT,
    "margin_pct" DECIMAL(6,4) NOT NULL,
    "margin_base" "MarginBase" NOT NULL,
    "expenses_pct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "expenses_fixed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "iva_pct" DECIMAL(6,4) NOT NULL,
    "rounding_rule" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "supplier_reference_id" TEXT,
    "pricing_rule_id" TEXT NOT NULL,
    "source_price_list_item_id" TEXT,
    "net_price" DECIMAL(14,4) NOT NULL,
    "computed_public_price" DECIMAL(14,2) NOT NULL,
    "source_type" "PriceSourceType" NOT NULL,
    "manual_reason" TEXT,
    "manual_authorized_by" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_counters" (
    "id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_notes" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "series" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'BORRADOR',
    "created_by" TEXT NOT NULL,
    "void_reason" TEXT,
    "voided_by" TEXT,
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_note_items" (
    "id" TEXT NOT NULL,
    "delivery_note_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "supplier_reference_id" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT,
    "code_snapshot" TEXT NOT NULL,
    "description_snapshot" TEXT NOT NULL,
    "settlement_item_id" TEXT,
    "stock_movement_id" TEXT,

    CONSTRAINT "delivery_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_note_documents" (
    "id" TEXT NOT NULL,
    "delivery_note_id" TEXT NOT NULL,
    "type" "DeliveryNoteDocumentType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_note_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_note_status_history" (
    "id" TEXT NOT NULL,
    "delivery_note_id" TEXT NOT NULL,
    "from_status" "DeliveryNoteStatus",
    "to_status" "DeliveryNoteStatus" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "delivery_note_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_movements" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "movement_date" DATE NOT NULL,
    "type" "AccountMovementType" NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_settlements" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'BORRADOR',
    "generated_by" TEXT NOT NULL,
    "voided_by" TEXT,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_settlement_items" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "price_history_id" TEXT NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "margin_pct_applied" DECIMAL(6,4),
    "expenses_pct_applied" DECIMAL(6,4),
    "iva_pct_applied" DECIMAL(6,4),
    "price_breakdown" JSONB,

    CONSTRAINT "account_settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requires_reference" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "reference_number" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'REGISTRADO',
    "voided_by" TEXT,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "ip_address" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "movement_type" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "warehouse_id" TEXT,
    "movement_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTRADO',

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_internal_code_key" ON "customers"("internal_code");

-- CreateIndex
CREATE INDEX "customers_business_name_idx" ON "customers"("business_name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_internal_code_key" ON "products"("internal_code");

-- CreateIndex
CREATE INDEX "products_description_idx" ON "products"("description");

-- CreateIndex
CREATE UNIQUE INDEX "product_supplier_references_supplier_id_supplier_code_key" ON "product_supplier_references"("supplier_id", "supplier_code");

-- CreateIndex
CREATE UNIQUE INDEX "import_mappings_supplier_id_key" ON "import_mappings"("supplier_id");

-- CreateIndex
CREATE INDEX "price_history_product_id_effective_from_idx" ON "price_history"("product_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "document_counters_doc_type_series_year_key" ON "document_counters"("doc_type", "series", "year");

-- CreateIndex
CREATE INDEX "delivery_notes_customer_id_status_idx" ON "delivery_notes"("customer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_notes_series_number_key" ON "delivery_notes"("series", "number");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_note_items_settlement_item_id_key" ON "delivery_note_items"("settlement_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_note_items_stock_movement_id_key" ON "delivery_note_items"("stock_movement_id");

-- CreateIndex
CREATE INDEX "account_movements_customer_id_movement_date_idx" ON "account_movements"("customer_id", "movement_date");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_name_key" ON "payment_methods"("name");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_occurred_at_idx" ON "audit_logs"("entity_type", "entity_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_supplier_references" ADD CONSTRAINT "product_supplier_references_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_supplier_references" ADD CONSTRAINT "product_supplier_references_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_imported_file_id_fkey" FOREIGN KEY ("imported_file_id") REFERENCES "imported_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_supplier_reference_id_fkey" FOREIGN KEY ("supplier_reference_id") REFERENCES "product_supplier_references"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_supplier_reference_id_fkey" FOREIGN KEY ("supplier_reference_id") REFERENCES "product_supplier_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "pricing_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_source_price_list_item_id_fkey" FOREIGN KEY ("source_price_list_item_id") REFERENCES "price_list_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_delivery_note_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_supplier_reference_id_fkey" FOREIGN KEY ("supplier_reference_id") REFERENCES "product_supplier_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_settlement_item_id_fkey" FOREIGN KEY ("settlement_item_id") REFERENCES "account_settlement_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_stock_movement_id_fkey" FOREIGN KEY ("stock_movement_id") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_documents" ADD CONSTRAINT "delivery_note_documents_delivery_note_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_status_history" ADD CONSTRAINT "delivery_note_status_history_delivery_note_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_settlements" ADD CONSTRAINT "account_settlements_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_settlement_items" ADD CONSTRAINT "account_settlement_items_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "account_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_settlement_items" ADD CONSTRAINT "account_settlement_items_price_history_id_fkey" FOREIGN KEY ("price_history_id") REFERENCES "price_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
