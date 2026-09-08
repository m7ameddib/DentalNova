import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface LicensePayload {
  product: string;
  clinicId: string;
  clinicName?: string;
  licenseId: string;
  installationId: string;
  issuedAt: string;
  expiresAt?: string | null;
}

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private publicKeysPem: string[] | null = null;
  private privateKeyPem: string | null = null;

  constructor(private readonly config: ConfigService) {}

  private loadPublicKeys(): string[] {
    if (this.publicKeysPem) return this.publicKeysPem;

    const keysDir = path.join(process.cwd(), 'keys');
    if (!fs.existsSync(keysDir)) {
      throw new BadRequestException('License verification key is not configured on this server.');
    }

    const keys: string[] = [];
    const seen = new Set<string>();

    const addKey = (filePath: string) => {
      if (!fs.existsSync(filePath)) return;
      const pem = fs.readFileSync(filePath, 'utf-8').trim();
      if (!pem || seen.has(pem)) return;
      seen.add(pem);
      keys.push(pem);
    };

    // Current production key first, then legacy keys for rotation compatibility.
    addKey(path.join(keysDir, 'license-public.pem'));
    addKey(path.join(keysDir, 'license-public-previous.pem'));

    for (const file of fs.readdirSync(keysDir)) {
      if (/^license-public-.+\.pem$/i.test(file)) {
        addKey(path.join(keysDir, file));
      }
    }

    if (keys.length === 0) {
      throw new BadRequestException('License verification key is not configured on this server.');
    }

    this.publicKeysPem = keys;
    return keys;
  }

  /** License file format: base64url(JSON payload) + '.' + base64url(RSA-SHA256 signature) */
  parseAndVerify(licenseText: string): LicensePayload {
    const trimmed = licenseText.trim();
    const dot = trimmed.lastIndexOf('.');
    if (dot <= 0) {
      throw new BadRequestException('Invalid license format.');
    }

    const payloadB64 = trimmed.slice(0, dot);
    const sigB64 = trimmed.slice(dot + 1);

    let payloadJson: string;
    let signature: Buffer;
    try {
      payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
      signature = Buffer.from(sigB64, 'base64url');
    } catch {
      throw new BadRequestException('Invalid license encoding.');
    }

    let payload: LicensePayload;
    try {
      payload = JSON.parse(payloadJson) as LicensePayload;
    } catch {
      throw new BadRequestException('Invalid license payload.');
    }

    if (payload.product !== 'DNT Dental') {
      throw new BadRequestException('This license is not for DNT Dental.');
    }
    if (!payload.clinicId || !payload.licenseId || !payload.issuedAt || !payload.installationId?.trim()) {
      throw new BadRequestException('License payload is missing required fields (including installation ID).');
    }

    if (payload.expiresAt) {
      const expiry = new Date(payload.expiresAt);
      if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        throw new BadRequestException('This license has expired.');
      }
    }

    const verified = this.loadPublicKeys().some((publicKey) => {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(payloadJson);
      verifier.end();
      return verifier.verify(publicKey, signature);
    });
    if (!verified) {
      throw new BadRequestException('License signature verification failed.');
    }

    return payload;
  }

  /** True when this server can issue signed offline licenses (licensing backend only). */
  canSign(): boolean {
    try {
      return Boolean(this.loadPrivateKey());
    } catch {
      return false;
    }
  }

  createPayload(params: {
    clinicId: string;
    clinicName: string;
    installationId: string;
    licenseId?: string;
    expiresAt?: string | null;
  }): LicensePayload {
    return {
      product: 'DNT Dental',
      clinicId: params.clinicId.trim(),
      clinicName: params.clinicName.trim(),
      licenseId: params.licenseId ?? crypto.randomUUID(),
      installationId: params.installationId.trim(),
      issuedAt: new Date().toISOString(),
      expiresAt: params.expiresAt ?? null,
    };
  }

  /** Build signed license string: base64url(JSON).base64url(signature) */
  signPayload(payload: LicensePayload): string {
    const payloadJson = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadJson, 'utf-8').toString('base64url');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(payloadJson);
    signer.end();
    const signatureB64 = signer.sign(this.loadPrivateKey()).toString('base64url');
    return `${payloadB64}.${signatureB64}`;
  }

  private loadPrivateKey(): string {
    if (this.privateKeyPem) return this.privateKeyPem;

    const envKey = this.config.get<string>('DNT_LICENSE_PRIVATE_KEY')?.trim();
    if (envKey?.includes('BEGIN')) {
      this.privateKeyPem = envKey;
      return this.privateKeyPem;
    }

    const keyPath =
      envKey ||
      path.join(process.cwd(), 'keys', 'license-private.pem');
    if (!fs.existsSync(keyPath)) {
      throw new BadRequestException('Offline license signing key is not configured on this server.');
    }
    this.privateKeyPem = fs.readFileSync(keyPath, 'utf-8');
    return this.privateKeyPem;
  }
}
