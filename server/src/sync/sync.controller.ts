import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { AuthenticatedUser } from '../auth/auth.types';
import { SkipSubscriptionGuard } from '../subscription/decorators/skip-subscription-guard.decorator';
import { SKIP_INSTALLATION_GUARD } from '../installation/guards/installation-ready.guard';
import { DeviceAuthGuard, SyncDevicePrincipal } from './device-auth.guard';
import { SyncPairingService } from './sync-pairing.service';
import { SyncEngineService } from './sync-engine.service';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service';
import { requestClientIp } from '../common/loopback.util';
import {
  ConnectOnlineDto,
  DeviceTokenDto,
  PairingCompleteDto,
  PairingPreviewDto,
  PushChangesDto,
  ResolveConflictDto,
} from './dto/sync.dto';
import { PlatformService } from '../platform/platform.service';
import { getTenantClinicId } from '../platform/tenant-context';

@Controller('sync')
export class SyncController {
  constructor(
    private readonly pairing: SyncPairingService,
    private readonly engine: SyncEngineService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly platform: PlatformService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  status() {
    return this.engine.status();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('pairing/start')
  startPairing(@CurrentUser() user: AuthenticatedUser) {
    return this.pairing.startPairing(user);
  }

  @SkipSubscriptionGuard()
  @SetMetadata(SKIP_INSTALLATION_GUARD, true)
  @Post('pairing/preview')
  previewPairing(@Body() dto: PairingPreviewDto, @Req() req: Request) {
    const key = `pair-preview:${requestClientIp(req)}`;
    this.rateLimit.assertAllowed(key, 20, 15 * 60 * 1000);
    try {
      const result = this.pairing.previewFromOnline(dto.code);
      this.rateLimit.recordSuccess(key);
      return result;
    } catch (err) {
      this.rateLimit.recordFailure(key, 15 * 60 * 1000);
      throw err;
    }
  }

  @SkipSubscriptionGuard()
  @SetMetadata(SKIP_INSTALLATION_GUARD, true)
  @Post('pairing/complete')
  completePairing(@Body() dto: PairingCompleteDto, @Req() req: Request) {
    const key = `pair:${requestClientIp(req)}`;
    this.rateLimit.assertAllowed(key, 8, 15 * 60 * 1000);
    try {
      const result = this.pairing.completeFromOnline(dto);
      this.rateLimit.recordSuccess(key);
      return result;
    } catch (err) {
      this.rateLimit.recordFailure(key, 15 * 60 * 1000);
      throw err;
    }
  }

  @SkipSubscriptionGuard()
  @SetMetadata(SKIP_INSTALLATION_GUARD, true)
  @Post('token')
  token(@Body() dto: DeviceTokenDto, @Req() req: Request) {
    const key = `sync-token:${requestClientIp(req)}:${dto.deviceId}`;
    this.rateLimit.assertAllowed(key, 20, 15 * 60 * 1000);
    try {
      const result = this.pairing.issueDeviceToken(dto.deviceId, dto.deviceSecret);
      this.rateLimit.recordSuccess(key);
      return result;
    } catch (err) {
      this.rateLimit.recordFailure(key, 15 * 60 * 1000);
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('connect/preview')
  previewConnect(@Body() dto: ConnectOnlineDto) {
    return this.pairing.previewOffline(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('connect')
  async connect(@Body() dto: ConnectOnlineDto) {
    return this.pairing.connectOffline(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('disconnect')
  async disconnect() {
    await this.pairing.disconnectOffline();
    return { disconnected: true };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('now')
  async syncNow() {
    return this.engine.runOfflineCycle();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('bootstrap')
  async bootstrap() {
    return this.engine.bootstrapOffline();
  }

  @UseGuards(JwtAuthGuard)
  @Get('conflicts')
  conflicts() {
    return this.engine.conflicts();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('conflicts/:id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveConflictDto) {
    return this.engine.resolve(id, dto.resolution);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('devices/:id/revoke')
  revoke(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const clinicId = user.clinicId || getTenantClinicId();
    if (!clinicId) throw new ForbiddenException();
    return { revoked: this.platform.revokeSyncDevice(clinicId, id) };
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Post('device/revoke-self')
  revokeSelf(@Req() req: Request & { syncDevice?: SyncDevicePrincipal }) {
    const device = req.syncDevice!;
    return { revoked: this.platform.revokeSyncDevice(device.clinicId, device.deviceId) };
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Post('push')
  push(@Req() req: Request & { syncDevice?: SyncDevicePrincipal }, @Body() dto: PushChangesDto) {
    const device = req.syncDevice!;
    try {
      return this.engine.pushFromDevice(device.deviceId, device.clinicId, dto.changes);
    } catch (err) {
      if ((err as Error).message === 'CROSS_CLINIC') throw new ForbiddenException('Cross-clinic sync is not allowed');
      throw err;
    }
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Get('changes')
  changes(
    @Req() req: Request & { syncDevice?: SyncDevicePrincipal },
    @Query('since') sinceRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const device = req.syncDevice!;
    const since = Number(sinceRaw ?? 0) || 0;
    const limit = Math.min(200, Number(limitRaw ?? 100) || 100);
    return this.engine.pullForDevice(device.deviceId, since, limit);
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Get('snapshot')
  snapshot(
    @Query('afterEntity') afterEntity?: string,
    @Query('afterId') afterIdRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    return this.engine.snapshotPage(
      afterEntity,
      Number(afterIdRaw ?? 0) || 0,
      Math.min(100, Number(limitRaw ?? 80) || 80),
    );
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Post('files')
  async uploadFile(
    @Body() body: { relativePath: string; contentBase64: string; mimeType?: string },
  ) {
    if (!body?.relativePath || !body.contentBase64) throw new BadRequestException('File payload required');
    if (body.contentBase64.length > 36_000_000) throw new BadRequestException('File is too large');
    try {
      const bytes = Buffer.from(body.contentBase64, 'base64');
      return await this.engine.putFileFromDevice(body.relativePath, bytes, body.mimeType);
    } catch (err) {
      throw new BadRequestException((err as Error).message || 'File store failed');
    }
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Get('files')
  async downloadFile(@Query('path') relativePath: string) {
    const bytes = await this.engine.getFileForDevice(relativePath);
    if (!bytes) return { found: false };
    return { found: true, contentBase64: bytes.toString('base64') };
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Post('checkpoint')
  checkpoint(@Req() req: Request & { syncDevice?: SyncDevicePrincipal }, @Body() body: { seq: number }) {
    return this.engine.ackDeviceCheckpoint(req.syncDevice!.deviceId, Number(body.seq) || 0);
  }
}
