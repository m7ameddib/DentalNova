import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { ClinicSettingsService } from './clinic-settings.service';
import { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings/clinic')
export class ClinicSettingsController {
  constructor(private readonly service: ClinicSettingsService) {}

  /** Readable by any authenticated user: needed for receipts + the Appointments working-hours grid. */
  @Get()
  get() {
    return this.service.get();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch()
  update(@Body() dto: UpdateClinicSettingsDto) {
    return this.service.update(dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('logo')
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage(), limits: { fileSize: MAX_LOGO_SIZE_BYTES } }))
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Logo must be an image file');
    }
    return this.service.saveLogo(file);
  }

  @Get('logo')
  getLogo(@Res() res: Response) {
    const absolutePath = this.service.getLogoAbsolutePath();
    res.sendFile(absolutePath);
  }
}
