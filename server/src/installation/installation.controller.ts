import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { InstallationService } from './installation.service';
import { ActivateLicenseDto, ActivateOnlineDto, FirstSetupDto } from './dto/installation.dto';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service';
import { requestClientIp } from '../common/loopback.util';

@Controller('installation')
export class InstallationController {
  constructor(
    private readonly installation: InstallationService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Get('status')
  status() {
    return this.installation.getStatus();
  }

  @Post('activate')
  activate(@Body() dto: ActivateLicenseDto) {
    return this.installation.activate(dto);
  }

  @Post('activate-online')
  activateOnline(@Body() dto: ActivateOnlineDto) {
    return this.installation.activateOnline(dto);
  }

  @Post('setup')
  async setup(@Body() dto: FirstSetupDto, @Req() req: Request) {
    const key = `install-setup:${requestClientIp(req)}`;
    this.rateLimit.assertAllowed(key, 8, 15 * 60 * 1000);
    this.rateLimit.recordFailure(key, 15 * 60 * 1000);
    return this.installation.completeSetup(dto);
  }
}
