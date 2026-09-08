import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/interceptors/audit.service';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { PricingRulesService } from '../pricing-rules/pricing-rules.service';
import { calculatePrice } from '../pricing-rules/pricing-engine';
import { parseWorkbook, UnsupportedLegacyXlsError } from './parsing/workbook-parser';
import { detectColumns, detectPositionalStart } from './parsing/column-detection';
import { extractMetadata } from './parsing/metadata-extraction';
import { extractCandidateCodes, runQualityChecks, ValidImportRow } from './parsing/quality-checks';
import { ColumnMapping } from './parsing/row-classification';
import { ConfirmSheetInput, ImportReport, PreviewResult, SheetImportReport, SheetPreview, SheetPreviewItem } from './price-lists.types';

const SAMPLE_SIZE = 20;

@Injectable()
export class PriceListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storage: FileStorageService,
    private readonly pricingRulesService: PricingRulesService,
  ) {}

  async preview(buffer: Buffer, supplierId: string): Promise<PreviewResult> {
    await this.assertSupplierExists(supplierId);

    const savedMapping = await this.prisma.importMapping.findUnique({ where: { supplierId } });
    const parsedSheets = await this.parseWorkbookOrThrow(buffer);

    const sheets: SheetPreview[] = [];
    for (const sheet of parsedSheets) {
      const detection = this.detectSheetColumns(sheet.rows, savedMapping?.columnMapping as unknown as ColumnMapping | undefined);

      if (!detection) {
        sheets.push(this.emptySheetPreview(sheet.sheetName));
        continue;
      }

      const metadata = extractMetadata(sheet.rows);
      const candidateCodes = extractCandidateCodes(sheet.rows, detection.dataStartRow, detection.mapping);
      const previousPrices = await this.getPreviousPrices(supplierId, candidateCodes);
      const quality = runQualityChecks(sheet.rows, detection.dataStartRow, detection.mapping, previousPrices);

      const existingCodes = new Set(previousPrices.keys());
      const sampleItems: SheetPreviewItem[] = quality.validItems.slice(0, SAMPLE_SIZE).map((item) => ({
        code: item.code,
        description: item.description,
        price: item.price,
        status: !existingCodes.has(item.code)
          ? 'NEW'
          : previousPrices.get(item.code) === item.price
            ? 'EXISTING_PRICE_SAME'
            : 'EXISTING_PRICE_CHANGED',
      }));

      sheets.push({
        sheetName: sheet.sheetName,
        detectionMode: detection.mode,
        mapping: detection.mapping,
        dataStartRow: detection.dataStartRow,
        suggestedEffectiveDate: metadata.effectiveDate ? metadata.effectiveDate.toISOString().slice(0, 10) : null,
        suggestedCurrency: metadata.currency,
        validCount: quality.validItems.length,
        newCount: quality.validItems.filter((item) => !existingCodes.has(item.code)).length,
        updatedCount: quality.validItems.filter((item) => existingCodes.has(item.code)).length,
        categoryRowCount: quality.categoryRows,
        errors: quality.errors.slice(0, 50),
        warnings: quality.warnings.slice(0, 50),
        sampleItems,
      });
    }

    return { sheets };
  }

  async confirm(
    buffer: Buffer,
    supplierId: string,
    sheetInputs: ConfirmSheetInput[],
    actingUserId: string,
  ): Promise<ImportReport> {
    await this.assertSupplierExists(supplierId);
    if (sheetInputs.length === 0) {
      throw new BadRequestException('No se seleccionó ninguna hoja para importar');
    }

    const parsedSheets = await this.parseWorkbookOrThrow(buffer);
    const storageKey = await this.storage.save(buffer, 'imported-files', '.xlsx');

    const importedFile = await this.prisma.importedFile.create({
      data: {
        supplierId,
        originalFilename: `${supplierId}.xlsx`,
        storageKey,
        sha256Hash: this.storage.hash(buffer),
        uploadedById: actingUserId,
      },
    });

    const reports: SheetImportReport[] = [];
    for (const input of sheetInputs) {
      if (!input.include) continue;

      const sheet = parsedSheets.find((s) => s.sheetName === input.sheetName);
      if (!sheet) {
        throw new BadRequestException(`La hoja "${input.sheetName}" no existe en el archivo`);
      }

      const report = await this.importSheet(sheet.rows, input, supplierId, importedFile.id, actingUserId);
      reports.push(report);
    }

    await this.prisma.importMapping.upsert({
      where: { supplierId },
      update: { columnMapping: sheetInputs[0].mapping as unknown as Prisma.InputJsonValue, updatedById: actingUserId },
      create: {
        supplierId,
        columnMapping: sheetInputs[0].mapping as unknown as Prisma.InputJsonValue,
        updatedById: actingUserId,
      },
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'price-lists',
      entityType: 'ImportedFile',
      entityId: importedFile.id,
      action: 'IMPORT',
      newValue: { supplierId, sheets: reports },
    });

    return { importedFileId: importedFile.id, sheets: reports };
  }

  private async importSheet(
    rows: Awaited<ReturnType<typeof parseWorkbook>>[number]['rows'],
    input: ConfirmSheetInput,
    supplierId: string,
    importedFileId: string,
    actingUserId: string,
  ): Promise<SheetImportReport> {
    const candidateCodes = extractCandidateCodes(rows, input.dataStartRow, input.mapping);
    const previousPrices = await this.getPreviousPrices(supplierId, candidateCodes);
    const quality = runQualityChecks(rows, input.dataStartRow, input.mapping, previousPrices);
    const existingCodes = new Set(previousPrices.keys());

    return this.prisma.$transaction(
      async (tx) => {
        const priceList = await tx.priceList.create({
          data: {
            supplierId,
            importedFileId,
            sheetName: input.sheetName,
            effectiveDate: new Date(input.effectiveDate),
            currency: input.currency,
            importedById: actingUserId,
            status: quality.errors.length > 0 ? 'PARTIAL' : 'PROCESSED',
          },
        });

        if (quality.errors.length > 0) {
          await tx.importError.createMany({
            data: quality.errors.map((error) => ({
              priceListId: priceList.id,
              rowNumber: error.rowNumber,
              rawData: error.rawData as unknown as Prisma.InputJsonValue,
              errorType: error.errorType,
              errorMessage: error.errorMessage,
            })),
          });
        }

        // Antes esto era un findUnique + (a veces) create + create por cada
        // fila, adentro de esta misma transacción: 2-3 round-trips a la
        // base por ítem. Con un archivo real de 30.066 filas (PreciosBULON)
        // eso son ~90.000 round-trips secuenciales y ~3 minutos bloqueando
        // la conexión. Se reemplaza por un puñado de consultas en lote,
        // sin importar cuántas filas tenga el archivo.
        const validCodes = quality.validItems.map((item) => item.code);

        const refSelect = { id: true, supplierCode: true, matchStatus: true, productId: true } as const;
        const existingRefs = await tx.productSupplierReference.findMany({
          where: { supplierId, supplierCode: { in: validCodes } },
          select: refSelect,
        });
        const refByCode = new Map(existingRefs.map((ref) => [ref.supplierCode, ref]));

        const newItems = quality.validItems.filter((item) => !refByCode.has(item.code));
        if (newItems.length > 0) {
          await tx.productSupplierReference.createMany({
            data: newItems.map((item) => ({
              supplierId,
              supplierCode: item.code,
              supplierDescription: item.description,
            })),
            skipDuplicates: true,
          });

          const createdRefs = await tx.productSupplierReference.findMany({
            where: { supplierId, supplierCode: { in: newItems.map((item) => item.code) } },
            select: refSelect,
          });
          for (const ref of createdRefs) refByCode.set(ref.supplierCode, ref);
        }
        const newReferences = newItems.length;

        await tx.priceListItem.createMany({
          data: quality.validItems.map((item) => ({
            priceListId: priceList.id,
            supplierReferenceId: refByCode.get(item.code)!.id,
            price: item.price,
            currency: input.currency,
          })),
        });
        const imported = quality.validItems.length;

        // recordPriceHistory solo aplica a referencias ya matcheadas con un
        // producto del catálogo maestro — en la práctica un subconjunto
        // chico (recién importado, la mayoría queda UNMATCHED), así que
        // dejarlo en un loop por ítem no es el cuello de botella.
        const matchedItems = quality.validItems.filter((item) => {
          const ref = refByCode.get(item.code)!;
          return ref.matchStatus === 'MATCHED' && ref.productId;
        });

        if (matchedItems.length > 0) {
          const matchedRefIds = matchedItems.map((item) => refByCode.get(item.code)!.id);
          const createdPriceListItems = await tx.priceListItem.findMany({
            where: { priceListId: priceList.id, supplierReferenceId: { in: matchedRefIds } },
            select: { id: true, supplierReferenceId: true },
          });
          const priceListItemIdByRefId = new Map(
            createdPriceListItems.map((pli) => [pli.supplierReferenceId, pli.id]),
          );

          for (const item of matchedItems) {
            const ref = refByCode.get(item.code)!;
            const priceListItemId = priceListItemIdByRefId.get(ref.id)!;
            await this.recordPriceHistory(tx, supplierId, ref.productId!, ref.id, priceListItemId, item, input.currency);
          }
        }

        return {
          sheetName: input.sheetName,
          priceListId: priceList.id,
          imported,
          newReferences,
          updatedReferences: quality.validItems.filter((item) => existingCodes.has(item.code)).length,
          errors: quality.errors.length,
          warnings: quality.warnings.length,
        };
      },
      { timeout: 120_000 },
    );
  }

  private async recordPriceHistory(
    tx: Prisma.TransactionClient,
    supplierId: string,
    productId: string,
    supplierReferenceId: string,
    priceListItemId: string,
    item: ValidImportRow,
    currency: string,
  ): Promise<void> {
    if (currency !== 'ARS') {
      // La conversión de moneda para el motor de precios queda pendiente
      // de la decisión de negocio documentada en docs/01-analisis-funcional.md
      // §8 (qué tipo de cambio y de qué fecha aplicar). Hasta entonces no
      // se calcula price_history para listas en moneda extranjera: el
      // price_list_item igual queda importado y trazable.
      return;
    }

    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) return;

    const rule = await this.pricingRulesService.resolveApplicableRule({
      productId,
      categoryId: product.categoryId,
      supplierId,
    });
    if (!rule) return;

    const breakdown = calculatePrice(item.price, {
      marginPct: Number(rule.marginPct),
      marginBase: rule.marginBase,
      expensesPct: Number(rule.expensesPct),
      expensesFixed: Number(rule.expensesFixed),
      ivaPct: Number(rule.ivaPct),
      roundingRule: rule.roundingRule,
    });

    const now = new Date();
    await tx.priceHistory.updateMany({
      where: { productId, supplierReferenceId, effectiveTo: null },
      data: { effectiveTo: now },
    });

    await tx.priceHistory.create({
      data: {
        productId,
        supplierReferenceId,
        pricingRuleId: rule.id,
        sourcePriceListItemId: priceListItemId,
        netPrice: item.price,
        computedPublicPrice: breakdown.finalPrice,
        sourceType: 'LIST_IMPORT',
        effectiveFrom: now,
      },
    });
  }

  private async parseWorkbookOrThrow(buffer: Buffer): Promise<Awaited<ReturnType<typeof parseWorkbook>>> {
    try {
      return await parseWorkbook(buffer);
    } catch (error) {
      if (error instanceof UnsupportedLegacyXlsError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async assertSupplierExists(supplierId: string): Promise<void> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      throw new NotFoundException('El proveedor indicado no existe');
    }
  }

  private async getPreviousPrices(supplierId: string, codes: string[]): Promise<Map<string, number>> {
    if (codes.length === 0) return new Map();

    const references = await this.prisma.productSupplierReference.findMany({
      where: { supplierId, supplierCode: { in: codes } },
      include: { priceListItems: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const map = new Map<string, number>();
    for (const reference of references) {
      const latest = reference.priceListItems[0];
      if (latest) map.set(reference.supplierCode, Number(latest.price));
    }
    return map;
  }

  private detectSheetColumns(rows: Awaited<ReturnType<typeof parseWorkbook>>[number]['rows'], savedMapping?: ColumnMapping) {
    if (savedMapping) {
      const withSavedMapping = detectPositionalStart(rows, savedMapping);
      if (withSavedMapping) return withSavedMapping;
    }
    return detectColumns(rows);
  }

  private emptySheetPreview(sheetName: string): SheetPreview {
    return {
      sheetName,
      detectionMode: 'none',
      mapping: null,
      dataStartRow: null,
      suggestedEffectiveDate: null,
      suggestedCurrency: null,
      validCount: 0,
      newCount: 0,
      updatedCount: 0,
      categoryRowCount: 0,
      errors: [],
      warnings: [],
      sampleItems: [],
    };
  }
}
