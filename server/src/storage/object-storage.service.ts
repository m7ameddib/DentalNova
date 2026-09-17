import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { UploadsService } from '../common/uploads.service';
import { DeploymentService } from '../common/deployment.service';
import { getTenantClinicId } from '../platform/tenant-context';
import { createHash } from 'crypto';
import { r2ObjectKey, withRetries } from './object-storage.util';

const DEFAULT_BUCKET = 'dentalnova-files';

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  private s3: import('@aws-sdk/client-s3').S3Client | null = null;
  private bucket = DEFAULT_BUCKET;
  private prefix = '';

  constructor(
    private readonly config: ConfigService,
    private readonly uploads: UploadsService,
    private readonly deployment: DeploymentService,
  ) {}

  async onModuleInit() {
    if (!this.r2Configured()) return;
    const { S3Client } = await import('@aws-sdk/client-s3');
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')?.trim();
    const endpoint =
      this.config.get<string>('R2_ENDPOINT')?.trim() ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
    this.bucket = this.config.get<string>('R2_BUCKET')?.trim() || DEFAULT_BUCKET;
    this.prefix = this.config.get<string>('R2_PREFIX')?.trim() || '';
    this.s3 = new S3Client({
      region: this.config.get<string>('R2_REGION')?.trim() || 'auto',
      endpoint,
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID')!.trim(),
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY')!.trim(),
      },
      forcePathStyle: true,
    });
    this.logger.log(`Object storage: Cloudflare R2 bucket ${this.bucket}`);
  }

  usesR2(): boolean {
    return Boolean(this.s3);
  }

  /** Safe status for Admin health. Never returns access keys or secrets. */
  async health(): Promise<{ configured: boolean; ok: boolean | null }> {
    if (!this.s3) return { configured: false, ok: null };
    try {
      const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { configured: true, ok: true };
    } catch {
      return { configured: true, ok: false };
    }
  }

  async putObject(relativePath: string, bytes: Buffer, mimeType?: string | null): Promise<void> {
    const local = this.uploads.resolveManagedPath(relativePath);
    if (!local) throw new Error('Invalid storage path');
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, bytes);
    if (this.s3) {
      try {
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        await withRetries(async () => {
          await this.s3!.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: this.objectKey(relativePath),
              Body: bytes,
              ContentType: mimeType || 'application/octet-stream',
            }),
          );
        });
      } catch (err) {
        this.logger.warn(`R2 put failed; local copy kept: ${(err as Error).message}`);
        if (this.deployment.isOnline()) {
          throw err;
        }
      }
    }
  }

  async getObject(relativePath: string): Promise<Buffer | null> {
    const local = this.uploads.resolveManagedPath(relativePath);
    if (local && fs.existsSync(local)) {
      return fs.readFileSync(local);
    }
    if (this.s3) {
      try {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const res = await withRetries(async () =>
          this.s3!.send(
            new GetObjectCommand({
              Bucket: this.bucket,
              Key: this.objectKey(relativePath),
            }),
          ),
        );
        const bytes = await this.streamToBuffer(res.Body);
        if (bytes && local) {
          fs.mkdirSync(path.dirname(local), { recursive: true });
          fs.writeFileSync(local, bytes);
        }
        return bytes;
      } catch (err) {
        this.logger.warn(`R2 get failed: ${(err as Error).message}`);
      }
    }
    return null;
  }

  localStat(relativePath: string): { bytes: number; sha256: string } | null {
    const local = this.uploads.resolveManagedPath(relativePath);
    if (!local || !fs.existsSync(local)) return null;
    const bytes = fs.readFileSync(local);
    return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }

  readRange(relativePath: string, offset: number, length: number): Buffer | null {
    const local = this.uploads.resolveManagedPath(relativePath);
    if (!local || !fs.existsSync(local)) return null;
    const fd = fs.openSync(local, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      if (offset < 0 || offset >= size) return Buffer.alloc(0);
      const take = Math.min(length, size - offset);
      const buf = Buffer.alloc(take);
      fs.readSync(fd, buf, 0, take, offset);
      return buf;
    } finally {
      fs.closeSync(fd);
    }
  }

  beginPartial(relativePath: string, byteSize: number): void {
    const part = this.partialPath(relativePath);
    if (!part) throw new Error('Invalid storage path');
    fs.mkdirSync(path.dirname(part), { recursive: true });
    const fd = fs.openSync(part, 'w');
    try {
      fs.ftruncateSync(fd, byteSize);
    } finally {
      fs.closeSync(fd);
    }
    fs.writeFileSync(`${part}.meta.json`, JSON.stringify({ relativePath, byteSize, received: 0 }));
  }

  writePartialRange(relativePath: string, offset: number, chunk: Buffer, expectedSize: number): { received: number } {
    const part = this.partialPath(relativePath);
    if (!part) throw new Error('Invalid storage path');
    if (!fs.existsSync(part)) throw new Error('File upload has not started');
    if (offset < 0 || offset + chunk.length > expectedSize) throw new Error('File chunk is out of range');
    const fd = fs.openSync(part, 'r+');
    try {
      fs.writeSync(fd, chunk, 0, chunk.length, offset);
    } finally {
      fs.closeSync(fd);
    }
    const metaFile = `${part}.meta.json`;
    let received = chunk.length;
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8')) as { received?: number };
      received = (Number(meta.received) || 0) + chunk.length;
    } catch {
      /* first chunk */
    }
    fs.writeFileSync(metaFile, JSON.stringify({ relativePath, byteSize: expectedSize, received }));
    return { received };
  }

  async finalizePartial(relativePath: string, sha256: string, mimeType?: string | null): Promise<{ bytes: number; sha256: string }> {
    const part = this.partialPath(relativePath);
    const local = this.uploads.resolveManagedPath(relativePath);
    if (!part || !local) throw new Error('Invalid storage path');
    if (!fs.existsSync(part)) throw new Error('File upload has not started');
    const bytes = fs.readFileSync(part);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== sha256) {
      throw new Error('File checksum did not match');
    }
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.renameSync(part, local);
    try {
      fs.unlinkSync(`${part}.meta.json`);
    } catch {
      /* ignore */
    }
    await this.putObject(relativePath, bytes, mimeType);
    return { bytes: bytes.length, sha256: digest };
  }

  private partialPath(relativePath: string): string | null {
    return this.uploads.resolveManagedPath(`${relativePath}.part`);
  }

  async deleteObject(relativePath: string): Promise<void> {
    this.uploads.deleteManagedFile(relativePath);
    if (this.s3) {
      try {
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
        await withRetries(async () => {
          await this.s3!.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: this.objectKey(relativePath),
            }),
          );
        });
      } catch (err) {
        this.logger.warn(`R2 delete failed: ${(err as Error).message}`);
      }
    }
  }

  /** R2-only write used for backup zips. Never deletes the local file. */
  async putRemoteObject(relativePath: string, bytes: Buffer, mimeType?: string | null): Promise<boolean> {
    if (!this.s3) return false;
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await withRetries(async () => {
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(relativePath),
          Body: bytes,
          ContentType: mimeType || 'application/octet-stream',
        }),
      );
    });
    return true;
  }

  private r2Configured(): boolean {
    const key = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secret = this.config.get<string>('R2_SECRET_ACCESS_KEY')?.trim();
    const account = this.config.get<string>('R2_ACCOUNT_ID')?.trim();
    const endpoint = this.config.get<string>('R2_ENDPOINT')?.trim();
    return Boolean(key && secret && (account || endpoint));
  }

  private objectKey(relativePath: string): string {
    return r2ObjectKey(relativePath, getTenantClinicId() || this.offlineTenantSegment(), this.prefix);
  }

  /** Offline installs that share one R2 bucket must not all land under `offline-local/`. */
  private offlineTenantSegment(): string {
    const dataDir = this.config.get<string>('DNT_DATA_DIR') || this.config.get<string>('DATABASE_FILE') || 'offline-local';
    return `offline-${createHash('sha256').update(String(dataDir)).digest('hex').slice(0, 12)}`;
  }

  private async streamToBuffer(body: unknown): Promise<Buffer | null> {
    if (!body) return null;
    if (Buffer.isBuffer(body)) return body;
    const maybe = body as { transformToByteArray?: () => Promise<Uint8Array> };
    if (typeof maybe.transformToByteArray === 'function') {
      return Buffer.from(await maybe.transformToByteArray());
    }
    return null;
  }
}
