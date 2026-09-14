import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class PairingCompleteDto {
  @IsString()
  @MinLength(4)
  code!: string;

  @IsString()
  deviceName!: string;

  @IsOptional()
  @IsString()
  installationId?: string;
}

export class ConnectOnlineDto {
  @IsString()
  onlineUrl!: string;

  @IsString()
  @MinLength(4)
  pairingCode!: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class DeviceTokenDto {
  @IsString()
  deviceId!: string;

  @IsString()
  deviceSecret!: string;
}

export class PushChangesDto {
  @IsArray()
  changes!: Array<{
    changeId: string;
    entity: string;
    recordUid: string;
    op: 'upsert' | 'delete' | 'void';
    row?: Record<string, unknown> | null;
  }>;
}

export class ResolveConflictDto {
  @IsString()
  resolution!: 'keep_local' | 'keep_remote';
}
