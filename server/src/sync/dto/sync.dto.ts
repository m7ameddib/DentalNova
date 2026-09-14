import { Type } from 'class-transformer';
import {
  Equals,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PairingCensusDto {
  @IsInt()
  @Min(0)
  patients!: number;

  @IsInt()
  @Min(0)
  payments!: number;

  @IsInt()
  @Min(0)
  treatments!: number;

  @IsInt()
  @Min(0)
  appointments!: number;

  @IsInt()
  @Min(0)
  total!: number;
}

export class PairingPreviewDto {
  @IsString()
  @MinLength(4)
  code!: string;
}

export class PairingCompleteDto {
  @IsString()
  @MinLength(4)
  code!: string;

  @IsString()
  deviceName!: string;

  @IsOptional()
  @IsString()
  installationId?: string;

  /** Offline must attest it has no operational clinic records. Online cannot inspect the Offline DB. */
  @IsBoolean()
  @Equals(true, {
    message:
      'Automatic pairing requires an empty Offline clinic (emptyClinic: true). Two populated databases cannot be merged.',
  })
  emptyClinic!: true;

  /**
   * Self-attested operational census from the Offline Nest process.
   * Online cannot inspect the Offline DB; a custom client can still lie.
   * Official Offline always sends the live SQLite census.
   */
  @IsObject()
  @ValidateNested()
  @Type(() => PairingCensusDto)
  census!: PairingCensusDto;
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
