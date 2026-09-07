import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PriceListsService } from './price-lists.service';
import { PreviewImportDto } from './dto/preview-import.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { ConfirmSheetInput } from './price-lists.types';
import { PrismaService } from '../../common/prisma/prisma.service';

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const uploadOptions = {
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    const hasValidExtension = /\.(xlsx|xls)$/i.test(file.originalname);
    if (!hasValidExtension || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(new BadRequestException('Solo se aceptan archivos Excel (.xlsx/.xls)'), false);
      return;
    }
    callback(null, true);
  },
};

@Controller('price-lists')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PriceListsController {
  constructor(
    private readonly priceListsService: PriceListsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('preview')
  @RequirePermissions('price-lists.import')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  preview(@UploadedFile() file: Express.Multer.File, @Body() dto: PreviewImportDto) {
    if (!file) throw new BadRequestException('Falta el archivo Excel');
    return this.priceListsService.preview(file.buffer, dto.supplierId);
  }

  @Post('confirm')
  @RequirePermissions('price-lists.import')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  confirm(@UploadedFile() file: Express.Multer.File, @Body() dto: ConfirmImportDto, @CurrentUser() user: AuthenticatedUser) {
    if (!file) throw new BadRequestException('Falta el archivo Excel');

    let sheets: ConfirmSheetInput[];
    try {
      sheets = JSON.parse(dto.sheetsJson);
    } catch {
      throw new BadRequestException('sheetsJson no es JSON válido');
    }
    if (!Array.isArray(sheets)) {
      throw new BadRequestException('sheetsJson debe ser un array');
    }

    return this.priceListsService.confirm(file.buffer, dto.supplierId, sheets, user.id);
  }

  @Get(':id/errors')
  @RequirePermissions('price-lists.import')
  getErrors(@Param('id') id: string) {
    return this.prisma.importError.findMany({ where: { priceListId: id }, orderBy: { rowNumber: 'asc' } });
  }
}
