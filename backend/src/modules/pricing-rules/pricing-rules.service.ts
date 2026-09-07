import { Injectable } from '@nestjs/common';
import { PricingRule, PricingRuleScope } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/interceptors/audit.service';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';

export interface ResolveRuleParams {
  productId?: string;
  categoryId?: string | null;
  supplierId?: string;
  at?: Date;
}

@Injectable()
export class PricingRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Nunca actualiza una regla existente: cierra la vigente del mismo
   * scope (effective_to = ahora) y crea una nueva versión, para poder
   * reconstruir con qué regla se liquidó una cuenta en el pasado (ver
   * docs/04-importacion-y-precios.md §6.1).
   */
  async create(dto: CreatePricingRuleDto, actingUserId: string): Promise<PricingRule> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.pricingRule.updateMany({
        where: { scope: dto.scope, scopeRefId: dto.scopeRefId ?? null, effectiveTo: null },
        data: { effectiveTo: now },
      });

      const created = await tx.pricingRule.create({
        data: {
          scope: dto.scope,
          scopeRefId: dto.scopeRefId ?? null,
          marginPct: dto.marginPct,
          marginBase: dto.marginBase,
          expensesPct: dto.expensesPct ?? 0,
          expensesFixed: dto.expensesFixed ?? 0,
          ivaPct: dto.ivaPct,
          roundingRule: dto.roundingRule,
          effectiveFrom: now,
          createdById: actingUserId,
        },
      });

      await this.auditService.record({
        userId: actingUserId,
        module: 'pricing-rules',
        entityType: 'PricingRule',
        entityId: created.id,
        action: 'CREATE',
        newValue: created,
      });

      return created;
    });
  }

  findAll(): Promise<PricingRule[]> {
    return this.prisma.pricingRule.findMany({ orderBy: { effectiveFrom: 'desc' } });
  }

  /**
   * Resuelve la regla más específica vigente para un producto en una
   * fecha dada: PRODUCT > CATEGORY > SUPPLIER > GLOBAL (docs/04 §6.1).
   * Devuelve null si no hay ninguna regla configurada en ningún nivel —
   * nunca se inventa una regla por defecto.
   */
  async resolveApplicableRule(params: ResolveRuleParams): Promise<PricingRule | null> {
    const at = params.at ?? new Date();

    const candidates: { scope: PricingRuleScope; scopeRefId: string | null }[] = [];
    if (params.productId) candidates.push({ scope: 'PRODUCT', scopeRefId: params.productId });
    if (params.categoryId) candidates.push({ scope: 'CATEGORY', scopeRefId: params.categoryId });
    if (params.supplierId) candidates.push({ scope: 'SUPPLIER', scopeRefId: params.supplierId });
    candidates.push({ scope: 'GLOBAL', scopeRefId: null });

    for (const candidate of candidates) {
      const rule = await this.prisma.pricingRule.findFirst({
        where: {
          scope: candidate.scope,
          scopeRefId: candidate.scopeRefId,
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (rule) return rule;
    }

    return null;
  }
}
