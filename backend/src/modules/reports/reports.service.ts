import { Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryNoteStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountStatementPdfService, AccountStatementPdfData, AccountStatementMovementRow } from './account-statement-pdf.service';
import { buildSpreadsheet, ExportFormat } from './export-writers';

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  REMITO_PENDIENTE: 'Remito pendiente',
  LIQUIDACION: 'Liquidación',
  PAGO: 'Pago',
  AJUSTE: 'Ajuste',
};

interface RawProductReportRow {
  id: string;
  internal_code: string;
  description: string;
  brand: string | null;
  unit: string | null;
  truck_application: string | null;
  status: string;
  best_price: string | null;
  best_currency: string | null;
  best_supplier_name: string | null;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountStatementPdf: AccountStatementPdfService,
  ) {}

  async exportCustomers(format: ExportFormat): Promise<Buffer> {
    const customers = await this.prisma.customer.findMany({ orderBy: { businessName: 'asc' } });

    return buildSpreadsheet(
      'Clientes',
      [
        { header: 'Código', key: 'code', width: 14 },
        { header: 'Razón social', key: 'name', width: 32 },
        { header: 'CUIT', key: 'cuit', width: 16 },
        { header: 'Teléfono', key: 'phone', width: 16 },
        { header: 'Email', key: 'email', width: 26 },
        { header: 'Ciudad', key: 'city', width: 18 },
        { header: 'Provincia', key: 'province', width: 18 },
        { header: 'Condición comercial', key: 'commercialCondition', width: 20 },
        { header: 'Límite de crédito', key: 'creditLimit', width: 18 },
        { header: 'Estado', key: 'status', width: 12 },
      ],
      customers.map((c) => ({
        code: c.internalCode,
        name: c.businessName,
        cuit: c.cuit ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        city: c.city ?? '',
        province: c.province ?? '',
        commercialCondition: c.commercialCondition ?? '',
        creditLimit: c.creditLimit ? Number(c.creditLimit) : '',
        status: c.status,
      })),
      format,
    );
  }

  /**
   * Catálogo con el mejor precio vigente por producto. Una sola consulta
   * con LATERAL JOIN (referencia matcheada -> último price_list_item de
   * cada una -> el más bajo) en vez de N llamadas a comparePrices, mismo
   * criterio que en la importación y el matching masivo: nunca un round-
   * trip por fila cuando el catálogo puede tener miles de productos.
   */
  async exportProducts(format: ExportFormat): Promise<Buffer> {
    const rows = await this.prisma.$queryRaw<RawProductReportRow[]>`
      SELECT
        p.id, p.internal_code, p.description, p.brand, p.unit, p.truck_application, p.status,
        bp.price::text AS best_price, bp.currency AS best_currency, bp.supplier_name AS best_supplier_name
      FROM products p
      LEFT JOIN LATERAL (
        SELECT latest.price, latest.currency, s.name AS supplier_name
        FROM product_supplier_references psr
        JOIN suppliers s ON s.id = psr.supplier_id
        JOIN LATERAL (
          SELECT pli.price, pli.currency
          FROM price_list_items pli
          WHERE pli.supplier_reference_id = psr.id
          ORDER BY pli.created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE psr.product_id = p.id AND psr.match_status = 'MATCHED'
        ORDER BY latest.price ASC
        LIMIT 1
      ) bp ON true
      WHERE p.status = 'ACTIVE'
      ORDER BY p.description ASC
    `;

    return buildSpreadsheet(
      'Productos',
      [
        { header: 'Código interno', key: 'code', width: 16 },
        { header: 'Descripción', key: 'description', width: 40 },
        { header: 'Marca', key: 'brand', width: 16 },
        { header: 'Unidad', key: 'unit', width: 12 },
        { header: 'Aplicación', key: 'truckApplication', width: 24 },
        { header: 'Mejor precio', key: 'bestPrice', width: 16 },
        { header: 'Moneda', key: 'bestCurrency', width: 10 },
        { header: 'Proveedor', key: 'bestSupplier', width: 22 },
      ],
      rows.map((r) => ({
        code: r.internal_code,
        description: r.description,
        brand: r.brand ?? '',
        unit: r.unit ?? '',
        truckApplication: r.truck_application ?? '',
        bestPrice: r.best_price ? Number(r.best_price) : '',
        bestCurrency: r.best_currency ?? '',
        bestSupplier: r.best_supplier_name ?? '',
      })),
      format,
    );
  }

  async exportDeliveryNotes(
    filters: { customerId?: string; status?: DeliveryNoteStatus; from?: Date; to?: Date },
    format: ExportFormat,
  ): Promise<Buffer> {
    const where: Prisma.DeliveryNoteWhereInput = {
      customerId: filters.customerId,
      status: filters.status,
      issuedAt:
        filters.from || filters.to
          ? { gte: filters.from, lte: filters.to }
          : undefined,
    };

    const notes = await this.prisma.deliveryNote.findMany({
      where,
      include: { customer: true, items: true },
      orderBy: { issuedAt: 'desc' },
    });

    // El remito no fija precio (regla de negocio central, docs/01 §1): el
    // reporte lista cantidad de ítems, nunca un total en pesos — eso vive
    // en la liquidación/cuenta corriente, no acá.
    return buildSpreadsheet(
      'Remitos',
      [
        { header: 'Número', key: 'number', width: 14 },
        { header: 'Serie', key: 'series', width: 10 },
        { header: 'Fecha', key: 'issuedAt', width: 14 },
        { header: 'Cliente', key: 'customerName', width: 32 },
        { header: 'Código cliente', key: 'customerCode', width: 16 },
        { header: 'Estado', key: 'status', width: 16 },
        { header: 'Cantidad de ítems', key: 'itemCount', width: 18 },
      ],
      notes.map((n) => ({
        number: n.number,
        series: n.series,
        issuedAt: n.issuedAt.toLocaleDateString('es-AR'),
        customerName: n.customer.businessName,
        customerCode: n.customer.internalCode,
        status: n.status,
        itemCount: n.items.length,
      })),
      format,
    );
  }

  private async loadAccountStatementData(
    customerId: string,
    filters: { from?: Date; to?: Date },
  ): Promise<{ data: AccountStatementPdfData; rows: Record<string, unknown>[] }> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const movements = await this.prisma.accountMovement.findMany({
      where: {
        customerId,
        movementDate:
          filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
      },
      orderBy: { movementDate: 'asc' },
    });

    const movementRows: AccountStatementMovementRow[] = movements.map((m) => ({
      movementDate: m.movementDate,
      typeLabel: MOVEMENT_TYPE_LABEL[m.type] ?? m.type,
      referenceLabel: `${m.referenceType} ${m.referenceId.slice(0, 8)}…`,
      debit: Number(m.debit),
      credit: Number(m.credit),
      balanceAfter: Number(m.balanceAfter),
    }));

    const finalBalance = movements.length > 0 ? Number(movements[movements.length - 1].balanceAfter) : 0;

    return {
      data: {
        customerName: customer.businessName,
        customerCode: customer.internalCode,
        customerCuit: customer.cuit,
        from: filters.from ?? null,
        to: filters.to ?? null,
        movements: movementRows,
        finalBalance,
      },
      rows: movementRows.map((m) => ({
        fecha: m.movementDate.toLocaleDateString('es-AR'),
        tipo: m.typeLabel,
        referencia: m.referenceLabel,
        debe: m.debit || '',
        haber: m.credit || '',
        saldo: m.balanceAfter,
      })),
    };
  }

  async exportAccountStatement(
    customerId: string,
    filters: { from?: Date; to?: Date },
    format: ExportFormat,
  ): Promise<Buffer> {
    const { rows } = await this.loadAccountStatementData(customerId, filters);

    return buildSpreadsheet(
      'Cuenta corriente',
      [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Tipo', key: 'tipo', width: 18 },
        { header: 'Referencia', key: 'referencia', width: 28 },
        { header: 'Debe', key: 'debe', width: 16 },
        { header: 'Haber', key: 'haber', width: 16 },
        { header: 'Saldo', key: 'saldo', width: 16 },
      ],
      rows,
      format,
    );
  }

  async exportAccountStatementPdf(customerId: string, filters: { from?: Date; to?: Date }): Promise<Buffer> {
    const { data } = await this.loadAccountStatementData(customerId, filters);
    return this.accountStatementPdf.generate(data);
  }
}
