import { Body, Controller, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { AccountDiscountsService } from './account-discounts.service';
import { CreateAccountDiscountDto } from './dto/create-account-discount.dto';
import { VoidAccountDiscountDto } from './dto/void-account-discount.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('account-discounts')
export class AccountDiscountsController {
  constructor(private readonly discountsService: AccountDiscountsService) {}

  @RequirePermissions(PERMISSIONS.PAYMENTS_CREATE)
  @Post()
  create(@Body() dto: CreateAccountDiscountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.discountsService.create(dto, user);
  }

  @RequirePermissions(PERMISSIONS.PAYMENTS_VOID)
  @Patch(':id/void')
  void(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidAccountDiscountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.discountsService.void(id, dto, user);
  }
}
