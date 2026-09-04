import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/payment-method.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  /** Active methods only — used wherever a payment method is picked (Add Payment). */
  @RequirePermissions(PERMISSIONS.PAYMENTS_VIEW)
  @Get()
  listActive() {
    return this.service.listActive();
  }

  /** Full list (active + inactive) — used by Settings > Payment Methods. */
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('catalog')
  listAll() {
    return this.service.listAll();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post()
  create(@Body() dto: CreatePaymentMethodDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePaymentMethodDto) {
    return this.service.update(id, dto);
  }
}
