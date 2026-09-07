import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { APP_VERSION } from '../common/version';
import { PathsService } from '../common/paths.service';

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: GitHubReleaseAsset[];
}

export interface UpdateStatusResponse {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseNotes: string | null;
  releasePublishedAt: string | null;
  downloadUrl: string | null;
  installerFileName: string | null;
  downloaded: boolean;
  downloadedPath: string | null;
  downloadedSizeBytes: number | null;
  githubRepo: string;
}

@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);
  private cachedRelease: GitHubRelease | null = null;
  private cachedAt = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly paths: PathsService,
  ) {}

  downloadsDir(): string {
    return path.join(this.paths.dataRoot(), 'downloads');
  }

  async getStatus(forceRefresh: boolean): Promise<UpdateStatusResponse> {
    const repo = this.githubRepo();
    const release = await this.fetchLatestRelease(forceRefresh);
    const asset = release ? this.findInstallerAsset(release) : null;
    const latestVersion = release ? this.normalizeVersion(release.tag_name) : null;
    const updateAvailable = Boolean(latestVersion && this.compareVersions(latestVersion, APP_VERSION) > 0);
    const downloadedPath = asset ? this.expectedDownloadPath(asset.name) : null;
    const downloaded = downloadedPath ? fs.existsSync(downloadedPath) : false;

    return {
      currentVersion: APP_VERSION,
      latestVersion,
      updateAvailable,
      releaseNotes: release?.body ?? null,
      releasePublishedAt: release?.published_at ?? null,
      downloadUrl: asset?.browser_download_url ?? null,
      installerFileName: asset?.name ?? null,
      downloaded,
      downloadedPath: downloaded ? downloadedPath : null,
      downloadedSizeBytes: downloaded && downloadedPath ? fs.statSync(downloadedPath).size : null,
      githubRepo: repo,
    };
  }

  async downloadLatestInstaller(): Promise<UpdateStatusResponse> {
    const status = await this.getStatus(true);
    if (!status.updateAvailable || !status.downloadUrl || !status.installerFileName) {
      throw new BadRequestException('No update installer is available from GitHub Releases.');
    }

    const dest = this.expectedDownloadPath(status.installerFileName);
    fs.mkdirSync(this.downloadsDir(), { recursive: true });

    this.logger.log(`Downloading update ${status.installerFileName} from GitHub Releases...`);
    const res = await fetch(status.downloadUrl, {
      headers: { Accept: 'application/octet-stream', 'User-Agent': 'DentalNova-Updater' },
    });
    if (!res.ok) {
      throw new InternalServerErrorException(`Failed to download update (${res.status}).`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    this.logger.log(`Update saved to ${dest}`);

    return this.getStatus(false);
  }

  async launchDownloadedInstaller(): Promise<{ launched: boolean; installerPath: string }> {
    const status = await this.getStatus(false);
    if (!status.downloaded || !status.downloadedPath) {
      throw new BadRequestException('Download the update installer first.');
    }

    if (process.platform !== 'win32') {
      throw new BadRequestException('Installer launch is supported on Windows only.');
    }

    const installerPath = status.downloadedPath;
    this.logger.log(`Launching update installer: ${installerPath}`);

    const child = spawn(installerPath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();

    return { launched: true, installerPath };
  }

  private githubRepo(): string {
    return this.config.get<string>('GITHUB_RELEASES_REPO') || 'm7ameddib/DentalNova';
  }

  private expectedDownloadPath(fileName: string): string {
    return path.join(this.downloadsDir(), fileName);
  }

  private async fetchLatestRelease(force: boolean): Promise<GitHubRelease | null> {
    const ttlMs = 15 * 60 * 1000;
    if (!force && this.cachedRelease && Date.now() - this.cachedAt < ttlMs) {
      return this.cachedRelease;
    }

    const repo = this.githubRepo();
    const url = `https://api.github.com/repos/${repo}/releases/latest`;

    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'DentalNova-Updater',
        },
      });

      if (res.status === 404) {
        this.logger.warn(`No GitHub release found for ${repo}`);
        return null;
      }

      if (!res.ok) {
        throw new Error(`GitHub API ${res.status}`);
      }

      const release = (await res.json()) as GitHubRelease;
      this.cachedRelease = release;
      this.cachedAt = Date.now();
      return release;
    } catch (err) {
      this.logger.warn(`GitHub Releases check failed: ${(err as Error).message}`);
      return null;
    }
  }

  private findInstallerAsset(release: GitHubRelease): GitHubReleaseAsset | null {
    return (
      release.assets.find((a) =>
        /^DNT-Dental-Main-Clinic-Setup-v.+\.exe$/i.test(a.name),
      ) ?? null
    );
  }

  private normalizeVersion(tag: string): string {
    return tag.replace(/^v/i, '').trim();
  }

  /** Returns 1 if a > b, -1 if a < b, 0 if equal. */
  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
    const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i += 1) {
      const da = pa[i] ?? 0;
      const db = pb[i] ?? 0;
      if (da > db) return 1;
      if (da < db) return -1;
    }
    return 0;
  }
}
