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
  async activate(@Body() dto: ActivateLicenseDto, @Req() req: Request) {
    const key = `install-activate:${requestClientIp(req)}`;
    this.rateLimit.assertAllowed(key, 8, 15 * 60 * 1000);
    try {
      const result = await this.installation.activate(dto);
      this.rateLimit.recordSuccess(key);
      return result;
    } catch (err) {
      this.rateLimit.recordFailure(key, 15 * 60 * 1000);
      throw err;
    }
  }

  @Post('activate-online')
  async activateOnline(@Body() dto: ActivateOnlineDto, @Req() req: Request) {
    const key = `install-activate-online:${requestClientIp(req)}`;
    this.rateLimit.assertAllowed(key, 8, 15 * 60 * 1000);
    try {
      const result = await this.installation.activateOnline(dto);
      this.rateLimit.recordSuccess(key);
      return result;
    } catch (err) {
      this.rateLimit.recordFailure(key, 15 * 60 * 1000);
      throw err;
    }
  }

  @Post('setup')
  async setup(@Body() dto: FirstSetupDto, @Req() req: Request) {
    const key = `install-setup:${requestClientIp(req)}`;
    this.rateLimit.assertAllowed(key, 8, 15 * 60 * 1000);
    this.rateLimit.recordFailure(key, 15 * 60 * 1000);
    return this.installation.completeSetup(dto);
  }
}
