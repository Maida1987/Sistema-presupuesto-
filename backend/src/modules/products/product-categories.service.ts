import { Injectable } from '@nestjs/common';
import { ProductCategory } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCategoryDto): Promise<ProductCategory> {
    return this.prisma.productCategory.create({ data: dto });
  }

  findAll(): Promise<ProductCategory[]> {
    return this.prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
  }
}
