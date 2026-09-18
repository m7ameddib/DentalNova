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

  @IsOptional()
  @IsInt()
  @Min(0)
  expenses?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  labCases?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  prescriptions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  notes?: number;
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

  @IsString()
  @MinLength(4)
  installationId!: string;

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

  @IsInt()
  @Min(1)
  @Type(() => Number)
  protocolVersion!: number;

  @IsString()
  @MinLength(16)
  challenge!: string;

  /** HMAC-SHA256 hex of the canonical empty-census payload, keyed by the pairing challenge. */
  @IsString()
  @MinLength(64)
  censusProof!: string;

  /** Ed25519 SPKI DER, base64url. Generated on official Offline at pair time. */
  @IsString()
  @MinLength(40)
  devicePublicKey!: string;

  /** Ed25519 signature of the canonical pairing transcript, proving possession of the device key. */
  @IsString()
  @MinLength(64)
  pairingSignature!: string;

  /** DibNova-signed Offline license bound to this installationId. */
  @IsString()
  @MinLength(32)
  license!: string;
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

export class RegisterDeviceKeyDto {
  @IsString()
  @MinLength(40)
  devicePublicKey!: string;
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

export class FileBeginDto {
  @IsString()
  relativePath!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  byteSize!: number;

  @IsOptional()
  @IsString()
  sha256?: string;
}

export class FileChunkDto {
  @IsString()
  relativePath!: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset!: number;

  @IsString()
  contentBase64!: string;
}

export class FileFinishDto {
  @IsString()
  relativePath!: string;

  @IsString()
  @MinLength(64)
  sha256!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
