import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { BackupService } from './backup.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('create')
  create() {
    return this.backupService.createBackup();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('list')
  list() {
    return this.backupService.listBackups();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('download/:filename')
  download(@Param('filename') filename: string) {
    return this.backupService.getBackupStream(filename);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('validate')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_req, file, cb) => cb(null, `dnt-restore-${Date.now()}${path.extname(file.originalname) || '.zip'}`),
      }),
      limits: { fileSize: 512 * 1024 * 1024 },
    }),
  )
  async validate(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('No backup file uploaded');
    try {
      const manifest = await this.backupService.validateUploadedBackup(file.path);
      return { valid: true, manifest };
    } finally {
      fs.rm(file.path, { force: true }, () => undefined);
    }
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('restore')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_req, file, cb) => cb(null, `dnt-restore-${Date.now()}${path.extname(file.originalname) || '.zip'}`),
      }),
      limits: { fileSize: 512 * 1024 * 1024 },
    }),
  )
  async restore(@UploadedFile() file: Express.Multer.File, @Body('confirm') confirm?: string) {
    if (!file) throw new Error('No backup file uploaded');
    try {
      return await this.backupService.restoreFromUpload(file.path, confirm === 'true' || confirm === '1');
    } finally {
      fs.rm(file.path, { force: true }, () => undefined);
    }
  }
}
