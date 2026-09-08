import { BadRequestException, Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { DeliveryNoteStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ReportsService } from './reports.service';
import { ExportFormat, exportContentType, exportFilename } from './export-writers';

function parseFormat(format?: string): ExportFormat {
  return format === 'csv' ? 'csv' : 'xlsx';
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Fecha inválida: ${value}`);
  }
  return date;
}

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('customers')
  @RequirePermissions('customers.read')
  async customers(@Query('format') format: string | undefined, @Res() res: Response) {
    const fmt = parseFormat(format);
    const buffer = await this.reportsService.exportCustomers(fmt);
    this.send(res, buffer, 'clientes', fmt);
  }

  @Get('products')
  @RequirePermissions('products.read')
  async products(@Query('format') format: string | undefined, @Res() res: Response) {
    const fmt = parseFormat(format);
    const buffer = await this.reportsService.exportProducts(fmt);
    this.send(res, buffer, 'productos', fmt);
  }

  @Get('delivery-notes')
  @RequirePermissions('delivery-notes.read')
  async deliveryNotes(
    @Query('format') format: string | undefined,
    @Query('customerId') customerId: string | undefined,
    @Query('status') status: DeliveryNoteStatus | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const fmt = parseFormat(format);
    const buffer = await this.reportsService.exportDeliveryNotes(
      { customerId, status, from: parseDate(from), to: parseDate(to) },
      fmt,
    );
    this.send(res, buffer, 'remitos', fmt);
  }

  @Get('customers/:id/account-statement')
  @RequirePermissions('customers.read')
  async accountStatement(
    @Param('id') customerId: string,
    @Query('format') format: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const filters = { from: parseDate(from), to: parseDate(to) };

    if (format === 'pdf') {
      const buffer = await this.reportsService.exportAccountStatementPdf(customerId, filters);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="extracto-cuenta-${customerId}.pdf"`,
      });
      res.send(buffer);
      return;
    }

    const fmt = parseFormat(format);
    const buffer = await this.reportsService.exportAccountStatement(customerId, filters, fmt);
    this.send(res, buffer, `extracto-cuenta-${customerId}`, fmt);
  }

  private send(res: Response, buffer: Buffer, baseName: string, format: ExportFormat) {
    res.set({
      'Content-Type': exportContentType(format),
      'Content-Disposition': `attachment; filename="${exportFilename(baseName, format)}"`,
    });
    res.send(buffer);
  }
}
