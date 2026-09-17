import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import archiver, { ArchiverError } from 'archiver';
import yauzl from 'yauzl';
import { DatabaseService } from '../database/database.service';
import { UploadsService } from '../common/uploads.service';
import { APP_VERSION } from '../common/version';
import { PlatformService } from '../platform/platform.service';
import { getTenantClinicId } from '../platform/tenant-context';
import { safeExtractZip } from '../common/safe-unzip.util';
import { ObjectStorageService } from '../storage/object-storage.service';
import {
  BACKUP_MANIFEST_VERSION,
  backupClinicMismatch,
  backupHashMismatch,
  BackupManifestIdentity,
  sha256Buffer,
} from './backup-manifest.util';
import { copyDirRecursive, replaceDirectoryAtomically, replaceFileAtomically } from './backup-fs.util';

const BACKUP_VERSION = BACKUP_MANIFEST_VERSION;

export type BackupManifest = BackupManifestIdentity;

export interface BackupInfo {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  r2Uploaded?: boolean;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private backupInProgress = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly uploads: UploadsService,
    private readonly config: ConfigService,
    private readonly platform: PlatformService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  private backupsDir(): string {
    const clinicId = getTenantClinicId();
    if (clinicId && this.platform.isEnabled()) {
      const dir = path.join(this.platform.clinicDataDir(clinicId), 'backups');
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    }
    const dataDir = this.config.get<string>('DNT_DATA_DIR');
    const base = dataDir ? path.resolve(dataDir) : path.dirname(this.db.getDbPath());
    const dir = path.join(base, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Stream files into a zip on disk — avoids loading the full archive into memory. */
  private async zipDirectory(sourceDir: string, zipPath: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);
      archive.on('warning', (err: ArchiverError) => {
        if (err.code === 'ENOENT') {
          this.logger.warn(`Zip warning: ${err.message}`);
          return;
        }
        reject(err);
      });

      archive.pipe(output);
      archive.directory(sourceDir, false);
      void archive.finalize();
    });
  }

  private readZipEntryNames(zipPath: string): Promise<Set<string>> {
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) {
          reject(err ?? new Error('Failed to open backup zip'));
          return;
        }

        const names = new Set<string>();
        zipfile.on('entry', (entry) => {
          names.add(entry.fileName.replace(/\\/g, '/'));
          zipfile.readEntry();
        });
        zipfile.on('end', () => resolve(names));
        zipfile.on('error', reject);
        zipfile.readEntry();
      });
    });
  }

  private async unzipArchive(zipPath: string, destDir: string): Promise<void> {
    await safeExtractZip(zipPath, destDir);
  }

  private async assertBackupZipValid(zipPath: string): Promise<void> {
    if (!fs.existsSync(zipPath)) {
      throw new InternalServerErrorException('Backup file was not created');
    }
    const stat = fs.statSync(zipPath);
    if (stat.size === 0) {
      throw new InternalServerErrorException('Backup file is empty');
    }

    const names = await this.readZipEntryNames(zipPath);
    if (!names.has('manifest.json') || !names.has('clinic.db')) {
      throw new InternalServerErrorException('Backup archive is missing required files');
    }
  }

  private currentBackupIdentity(): { clinicId: string | null; installationId: string | null } {
    const clinicId = getTenantClinicId() || null;
    let installationId: string | null = null;
    try {
      const row = this.db.connection
        .prepare(`SELECT installation_id AS installationId FROM app_installation WHERE id = 1`)
        .get() as { installationId?: string } | undefined;
      installationId = row?.installationId ?? null;
    } catch {
      installationId = null;
    }
    return { clinicId, installationId };
  }

  private assertRestoreIdentity(manifest: BackupManifest, dbPath: string): void {
    const identity = this.currentBackupIdentity();
    if (backupClinicMismatch(manifest.clinicId, identity.clinicId)) {
      throw new BadRequestException(
        'This backup belongs to a different Online clinic. Restore it only on that clinic.',
      );
    }
    if (manifest.dbSha256) {
      const actual = sha256Buffer(fs.readFileSync(dbPath));
      if (backupHashMismatch(manifest.dbSha256, actual)) {
        throw new BadRequestException('Backup clinic.db does not match its SHA-256 manifest hash. The archive may be corrupt.');
      }
    }
  }

  private validateManifest(manifest: BackupManifest): void {
    if (manifest.version !== 1 && manifest.version !== 2 && manifest.version !== 3) {
      throw new BadRequestException('Unsupported backup version');
    }
    if (!manifest.includes.includes('clinic.db')) {
      throw new BadRequestException('Backup is missing the database file');
    }
  }

  private readManifestFromDir(dir: string): BackupManifest {
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new BadRequestException('Backup is missing manifest.json');
    }
    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as BackupManifest;
    } catch {
      throw new BadRequestException('Backup manifest is invalid JSON');
    }
    this.validateManifest(manifest);
    const dbPath = path.join(dir, 'clinic.db');
    if (!fs.existsSync(dbPath)) {
      throw new BadRequestException('Backup is missing clinic.db');
    }
    this.assertRestoreIdentity(manifest, dbPath);
    return manifest;
  }

  async createBackup(): Promise<BackupInfo> {
    if (this.backupInProgress) {
      throw new ConflictException('A backup is already in progress. Please wait.');
    }

    this.backupInProgress = true;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const id = `dnt-backup-${stamp}`;
    const workDir = path.join(this.backupsDir(), `work-${stamp}`);
    let zipPath: string | undefined;

    fs.mkdirSync(workDir, { recursive: true });

    try {
      const dbBackupPath = path.join(workDir, 'clinic.db');
      await this.db.backupToFile(dbBackupPath);
      const dbStat = fs.statSync(dbBackupPath);
      if (dbStat.size === 0) {
        throw new InternalServerErrorException('Database backup failed');
      }

      const uploadsSrc = this.uploads.uploadsRoot();
      const uploadsDest = path.join(workDir, 'uploads');
      await copyDirRecursive(uploadsSrc, uploadsDest);

      const identity = this.currentBackupIdentity();
      const dbSha256 = sha256Buffer(fs.readFileSync(dbBackupPath));
      const manifest: BackupManifest = {
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        includes: ['clinic.db', 'uploads/'],
        clinicId: identity.clinicId,
        installationId: identity.installationId,
        dbSha256,
      };
      fs.writeFileSync(path.join(workDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

      zipPath = path.join(this.backupsDir(), `${id}.zip`);
      await this.zipDirectory(workDir, zipPath);
      await this.assertBackupZipValid(zipPath);

      const stat = fs.statSync(zipPath);
      let r2Uploaded = false;
      if (this.objectStorage.usesR2()) {
        try {
          const zipBytes = fs.readFileSync(zipPath);
          r2Uploaded = await this.objectStorage.putRemoteObject(`backups/${id}.zip`, zipBytes, 'application/zip');
        } catch (err) {
          this.logger.warn(`R2 backup copy failed; local zip kept: ${(err as Error).message}`);
        }
      }
      this.logger.log(`Backup created: ${id}.zip (${stat.size} bytes)${r2Uploaded ? ' + R2' : ''}`);
      return {
        id,
        filename: `${id}.zip`,
        createdAt: manifest.createdAt,
        sizeBytes: stat.size,
        r2Uploaded,
      };
    } catch (err) {
      if (zipPath && fs.existsSync(zipPath)) {
        fs.rmSync(zipPath, { force: true });
      }
      this.logger.error('Backup failed', err as Error);
      if (
        err instanceof BadRequestException ||
        err instanceof ConflictException ||
        err instanceof InternalServerErrorException
      ) {
        throw err;
      }
      throw new InternalServerErrorException('Backup failed');
    } finally {
      await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
      this.backupInProgress = false;
    }
  }

  listBackups(): BackupInfo[] {
    const dir = this.backupsDir();
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.zip'))
      .map((filename) => {
        const full = path.join(dir, filename);
        const stat = fs.statSync(full);
        return {
          id: filename.replace(/\.zip$/, ''),
          filename,
          createdAt: stat.mtime.toISOString(),
          sizeBytes: stat.size,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getBackupStream(filename: string): StreamableFile {
    const safe = path.basename(filename);
    if (!safe.endsWith('.zip')) {
      throw new BadRequestException('Backup file not found');
    }
    const full = path.join(this.backupsDir(), safe);
    if (!fs.existsSync(full)) {
      throw new BadRequestException('Backup file not found');
    }
    return new StreamableFile(createReadStream(full), {
      type: 'application/zip',
      disposition: `attachment; filename="${safe}"`,
    });
  }

  async validateUploadedBackup(tempPath: string): Promise<BackupManifest> {
    const extractDir = `${tempPath}-extract`;
    fs.mkdirSync(extractDir, { recursive: true });
    try {
      await this.unzipArchive(tempPath, extractDir);
      return this.readManifestFromDir(extractDir);
    } finally {
      fs.rm(extractDir, { recursive: true, force: true }, () => undefined);
    }
  }

  /** Removes leftover WAL/SHM sidecar files next to a database file, if present. */
  private removeWalSidecars(dbPath: string): void {
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${dbPath}${suffix}`;
      if (fs.existsSync(sidecar)) {
        fs.rmSync(sidecar, { force: true });
      }
    }
  }

  /**
   * Restores clinic data from a validated backup zip. Creates a safety backup
   * of the current data first. The live database connection is closed while
   * the file on disk is replaced and reopened immediately after, so restored
   * data is served right away without requiring an application restart.
   */
  async restoreFromUpload(tempPath: string, confirm: boolean): Promise<{ restored: true; safetyBackupId: string; restartRequired: false }> {
    if (!confirm) {
      throw new BadRequestException('Restore requires explicit confirmation');
    }

    const manifest = await this.validateUploadedBackup(tempPath);
    const safety = await this.createBackup();

    const extractDir = path.join(this.backupsDir(), `restore-${Date.now()}`);
    fs.mkdirSync(extractDir, { recursive: true });

    try {
      await this.unzipArchive(tempPath, extractDir);
      this.readManifestFromDir(extractDir);

      const dbSrc = path.join(extractDir, 'clinic.db');
      const dbDest = this.db.getDbPath();
      const uploadsSrc = path.join(extractDir, 'uploads');
      const uploadsDest = this.uploads.uploadsRoot();

      // Close the live connection before touching the file on disk so no
      // stale WAL/SHM data from the previous connection can survive and
      // shadow the restored database once queries resume.
      await this.db.withConnectionClosed(async () => {
        this.removeWalSidecars(dbDest);
        const previousDb = `${dbDest}.pre-restore`;
        if (fs.existsSync(dbDest)) {
          fs.copyFileSync(dbDest, previousDb);
        }
        try {
          replaceFileAtomically(dbSrc, dbDest);
          this.removeWalSidecars(dbDest);

          if (fs.existsSync(uploadsSrc)) {
            await replaceDirectoryAtomically(uploadsSrc, uploadsDest);
          }
          if (fs.existsSync(previousDb)) fs.rmSync(previousDb, { force: true });
        } catch (err) {
          if (fs.existsSync(previousDb)) {
            try {
              replaceFileAtomically(previousDb, dbDest);
              this.removeWalSidecars(dbDest);
            } catch (rollbackErr) {
              this.logger.error('Failed to roll back clinic.db after a failed restore', rollbackErr as Error);
            }
          }
          throw err;
        }
      });

      this.logger.warn(`Clinic data restored from backup created ${manifest.createdAt}.`);
      return { restored: true, safetyBackupId: safety.id, restartRequired: false };
    } catch (err) {
      this.logger.error('Restore failed', err);
      throw new InternalServerErrorException('Restore failed — your safety backup was preserved');
    } finally {
      fs.rm(extractDir, { recursive: true, force: true }, () => undefined);
    }
  }
}
