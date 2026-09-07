import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DeliveryNoteStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { DeliveryNotesService } from './delivery-notes.service';
import { CreateDeliveryNoteDto } from './dto/create-delivery-note.dto';
import { VoidDeliveryNoteDto } from './dto/void-delivery-note.dto';

const MAX_SIGNATURE_SIZE_BYTES = 10 * 1024 * 1024;

@Controller('delivery-notes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeliveryNotesController {
  constructor(private readonly deliveryNotesService: DeliveryNotesService) {}

  @Get()
  @RequirePermissions('delivery-notes.read')
  findAll(@Query('customerId') customerId?: string, @Query('status') status?: DeliveryNoteStatus) {
    return this.deliveryNotesService.findAll({ customerId, status });
  }

  @Get(':id')
  @RequirePermissions('delivery-notes.read')
  findOne(@Param('id') id: string) {
    return this.deliveryNotesService.findOne(id);
  }

  @Post()
  @RequirePermissions('delivery-notes.write')
  create(@Body() dto: CreateDeliveryNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveryNotesService.create(dto, user.id);
  }

  @Get(':id/pdf')
  @RequirePermissions('delivery-notes.read')
  async pdf(@Param('id') id: string, @Query('type') type: string, @Res() res: Response) {
    const copyType = type?.toUpperCase() === 'DUPLICADO' ? 'DUPLICADO' : 'ORIGINAL';
    const buffer = await this.deliveryNotesService.generatePdf(id, copyType);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="remito-${id}-${copyType.toLowerCase()}.pdf"` });
    res.send(buffer);
  }

  @Post(':id/deliver')
  @RequirePermissions('delivery-notes.write')
  markDelivered(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveryNotesService.markDelivered(id, user.id);
  }

  @Post(':id/documents')
  @RequirePermissions('delivery-notes.write')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SIGNATURE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowed.includes(file.mimetype)) {
          callback(new BadRequestException('Solo se aceptan PDF, JPG o PNG'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  attachSignedDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo');
    return this.deliveryNotesService.attachSignedDocument(id, file.buffer, file.mimetype, user.id);
  }

  @Get('documents/:documentId/file')
  @RequirePermissions('delivery-notes.read')
  async downloadSignedDocument(@Param('documentId') documentId: string, @Res() res: Response) {
    const { buffer, mimetype } = await this.deliveryNotesService.readSignedDocument(documentId);
    res.set({ 'Content-Type': mimetype });
    res.send(buffer);
  }

  @Post(':id/void')
  @RequirePermissions('delivery-notes.write')
  void(@Param('id') id: string, @Body() dto: VoidDeliveryNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveryNotesService.void(id, dto.reason, user.id);
  }
}
