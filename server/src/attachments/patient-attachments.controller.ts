import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { PatientAttachmentsService } from './patient-attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { AuthenticatedUser } from '../auth/auth.types';

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('patients/:patientId/attachments')
export class PatientAttachmentsController {
  constructor(private readonly service: PatientAttachmentsService) {}

  @RequirePermissions(PERMISSIONS.PATIENTS_VIEW)
  @Get()
  list(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.service.list(patientId);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_EDIT)
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }))
  upload(
    @Param('patientId', ParseIntPipe) patientId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateAttachmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upload(patientId, file, dto, user);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_VIEW)
  @Get(':attachmentId/file')
  getFile(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Res() res: Response,
  ) {
    const { absolutePath, mimeType, fileName } = this.service.getFileAbsolutePath(patientId, attachmentId);
    if (mimeType) res.type(mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.sendFile(absolutePath);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_EDIT)
  @Delete(':attachmentId')
  remove(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
  ) {
    return this.service.remove(patientId, attachmentId);
  }
}
