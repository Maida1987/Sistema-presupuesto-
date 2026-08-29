import { Injectable, NotFoundException } from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/interceptors/audit.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, actingUserId: string): Promise<Customer> {
    const customer = await this.prisma.customer.create({
      data: { ...dto, createdById: actingUserId },
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'customers',
      entityType: 'Customer',
      entityId: customer.id,
      action: 'CREATE',
      newValue: customer,
    });

    return customer;
  }

  async findAll(search?: string): Promise<Customer[]> {
    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { businessName: { contains: search, mode: 'insensitive' } },
            { internalCode: { contains: search, mode: 'insensitive' } },
            { cuit: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    return this.prisma.customer.findMany({ where, orderBy: { businessName: 'asc' } });
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, actingUserId: string): Promise<Customer> {
    const existing = await this.findOne(id);

    const updated = await this.prisma.customer.update({
      where: { id },
      data: dto,
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'customers',
      entityType: 'Customer',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async setStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actingUserId: string): Promise<Customer> {
    const existing = await this.findOne(id);

    const updated = await this.prisma.customer.update({
      where: { id },
      data: { status },
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'customers',
      entityType: 'Customer',
      entityId: id,
      action: status === 'ACTIVE' ? 'REACTIVATE' : 'DEACTIVATE',
      oldValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    return updated;
  }
}
