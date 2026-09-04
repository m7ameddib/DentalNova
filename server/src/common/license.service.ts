import { Injectable, BadRequestException } from '@nestjs/common';
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
  private publicKeyPem: string | null = null;

  private loadPublicKey(): string {
    if (this.publicKeyPem) return this.publicKeyPem;
    const keyPath = path.join(process.cwd(), 'keys', 'license-public.pem');
    if (!fs.existsSync(keyPath)) {
      throw new BadRequestException('License verification key is not configured on this server.');
    }
    this.publicKeyPem = fs.readFileSync(keyPath, 'utf-8');
    return this.publicKeyPem;
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

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(payloadJson);
    verifier.end();
    const ok = verifier.verify(this.loadPublicKey(), signature);
    if (!ok) {
      throw new BadRequestException('License signature verification failed.');
    }

    return payload;
  }
}
