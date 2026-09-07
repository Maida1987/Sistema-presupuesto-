import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PricingRulesService } from './pricing-rules.service';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';

@Controller('pricing-rules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PricingRulesController {
  constructor(private readonly pricingRulesService: PricingRulesService) {}

  @Get()
  @RequirePermissions('pricing-rules.write')
  findAll() {
    return this.pricingRulesService.findAll();
  }

  @Post()
  @RequirePermissions('pricing-rules.write')
  create(@Body() dto: CreatePricingRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pricingRulesService.create(dto, user.id);
  }
}
