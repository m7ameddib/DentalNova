import { Module } from '@nestjs/common';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DisabledSyncProvider } from './sync.interface';

@UseGuards(JwtAuthGuard)
@Controller('sync')
class SyncController {
  private readonly provider = new DisabledSyncProvider();

  @Get('status')
  status() {
    return { enabled: this.provider.isEnabled() };
  }
}

@Module({
  controllers: [SyncController],
})
export class SyncModule {}
