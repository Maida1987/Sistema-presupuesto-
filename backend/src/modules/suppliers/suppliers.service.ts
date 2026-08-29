import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/interceptors/audit.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateSupplierDto, actingUserId: string): Promise<Supplier> {
    const supplier = await this.prisma.supplier.create({ data: dto });

    await this.auditService.record({
      userId: actingUserId,
      module: 'suppliers',
      entityType: 'Supplier',
      entityId: supplier.id,
      action: 'CREATE',
      newValue: supplier,
    });

    return supplier;
  }

  async findAll(search?: string): Promise<Supplier[]> {
    const where: Prisma.SupplierWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    return this.prisma.supplier.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto, actingUserId: string): Promise<Supplier> {
    const existing = await this.findOne(id);

    const updated = await this.prisma.supplier.update({ where: { id }, data: dto });

    await this.auditService.record({
      userId: actingUserId,
      module: 'suppliers',
      entityType: 'Supplier',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async setStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actingUserId: string): Promise<Supplier> {
    const existing = await this.findOne(id);

    const updated = await this.prisma.supplier.update({ where: { id }, data: { status } });

    await this.auditService.record({
      userId: actingUserId,
      module: 'suppliers',
      entityType: 'Supplier',
      entityId: id,
      action: status === 'ACTIVE' ? 'REACTIVATE' : 'DEACTIVATE',
      oldValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    return updated;
  }
}
