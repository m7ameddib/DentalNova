import { Controller, Get, Post, Body } from '@nestjs/common';
import { InstallationService } from './installation.service';
import { ActivateLicenseDto, FirstSetupDto } from './dto/installation.dto';

@Controller('installation')
export class InstallationController {
  constructor(private readonly installation: InstallationService) {}

  @Get('status')
  status() {
    return this.installation.getStatus();
  }

  @Post('activate')
  activate(@Body() dto: ActivateLicenseDto) {
    return this.installation.activate(dto);
  }

  @Post('setup')
  async setup(@Body() dto: FirstSetupDto) {
    return this.installation.completeSetup(dto);
  }
}
