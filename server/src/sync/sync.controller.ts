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
  FileBeginDto,
  FileChunkDto,
  FileFinishDto,
  PairingCompleteDto,
  PairingPreviewDto,
  PushChangesDto,
  ResolveConflictDto,
} from './dto/sync.dto';
import { PlatformService } from '../platform/platform.service';
import { getTenantClinicId } from '../platform/tenant-context';
import {
  decodeFileChunkBase64,
  FILE_INLINE_MAX_BYTES,
} from './sync-files.util';
import {
  isCompatibleSyncProtocol,
  protocolVersionFromHeaders,
  SYNC_PROTOCOL_MISMATCH,
} from './sync-protocol.util';

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
    this.assertSyncProtocol(req);
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
    this.assertSyncProtocol(req);
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
    const result = await this.engine.runOfflineCycle({ forceAttachments: true });
    if (result.error) throw new BadRequestException(result.error);
    return result;
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
    @Req() req: Request & { syncDevice?: SyncDevicePrincipal },
    @Query('afterEntity') afterEntity?: string,
    @Query('afterId') afterIdRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    return this.engine.snapshotPage(
      req.syncDevice!.deviceId,
      afterEntity,
      Number(afterIdRaw ?? 0) || 0,
      Math.min(100, Number(limitRaw ?? 80) || 80),
    );
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Post('files')
  async uploadFile(
    @Req() req: Request & { syncDevice?: SyncDevicePrincipal },
    @Body() body: { relativePath: string; contentBase64: string; mimeType?: string },
  ) {
    if (!body?.relativePath || !body.contentBase64) throw new BadRequestException('File payload required');
    if (body.contentBase64.length > 400_000) {
      throw new BadRequestException('File is too large for a single request. Upload it in 256 KiB chunks.');
    }
    try {
      const bytes = Buffer.from(body.contentBase64, 'base64');
      if (bytes.length > FILE_INLINE_MAX_BYTES) {
        throw new BadRequestException('File is too large for a single request. Upload it in 256 KiB chunks.');
      }
      return await this.engine.putFileFromDevice(req.syncDevice!.deviceId, body.relativePath, bytes, body.mimeType);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException((err as Error).message || 'File store failed');
    }
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Post('files/begin')
  async beginFile(@Req() req: Request & { syncDevice?: SyncDevicePrincipal }, @Body() body: FileBeginDto) {
    try {
      return await this.engine.beginFileFromDevice(
        req.syncDevice!.deviceId,
        body.relativePath,
        body.byteSize,
        body.mimeType,
        body.sha256,
      );
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException((err as Error).message || 'File upload could not start');
    }
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Post('files/chunk')
  async chunkFile(@Req() req: Request & { syncDevice?: SyncDevicePrincipal }, @Body() body: FileChunkDto) {
    try {
      const bytes = decodeFileChunkBase64(body.contentBase64);
      return await this.engine.putFileChunkFromDevice(req.syncDevice!.deviceId, body.relativePath, body.offset, bytes);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException((err as Error).message || 'File chunk failed');
    }
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Post('files/finish')
  async finishFile(@Req() req: Request & { syncDevice?: SyncDevicePrincipal }, @Body() body: FileFinishDto) {
    try {
      return await this.engine.finishFileFromDevice(
        req.syncDevice!.deviceId,
        body.relativePath,
        body.sha256,
        body.mimeType,
      );
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException((err as Error).message || 'File upload could not finish');
    }
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Get('files')
  async downloadFile(
    @Query('path') relativePath: string,
    @Query('offset') offsetRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    if (offsetRaw != null || limitRaw != null) {
      return this.engine.getFileChunkForDevice(
        relativePath,
        Number(offsetRaw ?? 0) || 0,
        Number(limitRaw ?? 0) || 0,
      );
    }
    return this.engine.getFileMetaOrInlineForDevice(relativePath);
  }

  @UseGuards(DeviceAuthGuard)
  @SkipSubscriptionGuard()
  @Post('checkpoint')
  checkpoint(@Req() req: Request & { syncDevice?: SyncDevicePrincipal }, @Body() body: { seq: number }) {
    return this.engine.ackDeviceCheckpoint(req.syncDevice!.deviceId, Number(body.seq) || 0);
  }

  private assertSyncProtocol(req: Request): void {
    const version = protocolVersionFromHeaders(req.headers as Record<string, unknown>);
    if (!isCompatibleSyncProtocol(version)) {
      throw new BadRequestException({ statusCode: 400, message: SYNC_PROTOCOL_MISMATCH, code: 'SYNC_PROTOCOL_MISMATCH' });
    }
  }
}
