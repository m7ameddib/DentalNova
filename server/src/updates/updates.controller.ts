import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { DeploymentService } from '../common/deployment.service';
import { UpdatesService } from './updates.service';

@Controller('updates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UpdatesController {
  constructor(
    private readonly updates: UpdatesService,
    private readonly deployment: DeploymentService,
  ) {}

  private assertOffline(): void {
    if (!this.deployment.isOffline()) {
      throw new BadRequestException('In-app updates are available in offline desktop mode only.');
    }
  }

  @Get('status')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async status() {
    this.assertOffline();
    return this.updates.getStatus(false);
  }

  @Post('check')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async check() {
    this.assertOffline();
    return this.updates.getStatus(true);
  }

  @Post('download')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async download() {
    this.assertOffline();
    return this.updates.downloadLatestInstaller();
  }

  @Post('launch-installer')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async launchInstaller() {
    this.assertOffline();
    return this.updates.launchDownloadedInstaller();
  }
}
