import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { createWriteStream } from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
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
  draft?: boolean;
  prerelease?: boolean;
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
  checkError: string | null;
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
    try {
      const release = await this.fetchLatestRelease(forceRefresh);
      const asset = this.findInstallerAsset(release);
      const latestVersion = this.normalizeVersion(release.tag_name);
      const updateAvailable = this.compareVersions(latestVersion, APP_VERSION) > 0;
      const downloadedPath = asset ? this.expectedDownloadPath(asset.name) : null;
      const downloaded = downloadedPath ? fs.existsSync(downloadedPath) : false;

      return {
        currentVersion: APP_VERSION,
        latestVersion,
        updateAvailable,
        releaseNotes: release.body ?? null,
        releasePublishedAt: release.published_at ?? null,
        downloadUrl: asset?.browser_download_url ?? null,
        installerFileName: asset?.name ?? null,
        downloaded,
        downloadedPath: downloaded ? downloadedPath : null,
        downloadedSizeBytes: downloaded && downloadedPath ? fs.statSync(downloadedPath).size : null,
        githubRepo: repo,
        checkError: null,
      };
    } catch (err) {
      const checkError = (err as Error).message || 'GitHub Releases check failed.';
      this.logger.warn(checkError);
      if (forceRefresh) {
        throw new InternalServerErrorException(checkError);
      }
      return {
        currentVersion: APP_VERSION,
        latestVersion: null,
        updateAvailable: false,
        releaseNotes: null,
        releasePublishedAt: null,
        downloadUrl: null,
        installerFileName: null,
        downloaded: false,
        downloadedPath: null,
        downloadedSizeBytes: null,
        githubRepo: repo,
        checkError,
      };
    }
  }

  async downloadLatestInstaller(): Promise<UpdateStatusResponse> {
    const release = await this.fetchLatestRelease(true);
    const asset = this.findInstallerAsset(release);
    const latestVersion = this.normalizeVersion(release.tag_name);
    const updateAvailable = this.compareVersions(latestVersion, APP_VERSION) > 0;

    if (!updateAvailable || !asset) {
      throw new BadRequestException('No update installer is available from GitHub Releases.');
    }

    const dest = this.expectedDownloadPath(asset.name);
    fs.mkdirSync(this.downloadsDir(), { recursive: true });

    this.logger.log(`Downloading update ${asset.name} from GitHub Releases...`);
    const res = await fetch(asset.browser_download_url, {
      headers: this.githubRequestHeaders('application/octet-stream'),
    });
    if (!res.ok || !res.body) {
      throw new InternalServerErrorException(`Failed to download update (${res.status}).`);
    }

    await pipeline(Readable.fromWeb(res.body as import('stream/web').ReadableStream), createWriteStream(dest));
    await this.verifyInstallerChecksum(dest, asset.name, release);
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

  private githubRequestHeaders(accept: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: accept,
      'User-Agent': 'DentalNova-Updater',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const token = this.config.get<string>('GITHUB_TOKEN')?.trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  private expectedDownloadPath(fileName: string): string {
    return path.join(this.downloadsDir(), fileName);
  }

  private async fetchLatestRelease(force: boolean): Promise<GitHubRelease> {
    const ttlMs = 15 * 60 * 1000;
    if (!force && this.cachedRelease && Date.now() - this.cachedAt < ttlMs) {
      return this.cachedRelease;
    }

    const repo = this.githubRepo();
    const latestResult = await this.githubApi<GitHubRelease>(
      `https://api.github.com/repos/${repo}/releases/latest`,
    );

    let release: GitHubRelease | null = null;
    if (latestResult.ok && latestResult.data?.tag_name) {
      release = latestResult.data;
    }

    if (!release || !this.findInstallerAsset(release)) {
      const listResult = await this.githubApi<GitHubRelease[]>(
        `https://api.github.com/repos/${repo}/releases?per_page=30`,
      );
      if (!listResult.ok) {
        throw new Error(listResult.message);
      }
      release = this.pickLatestPublishedRelease(listResult.data) ?? release;
    }

    if (!release) {
      throw new Error(
        latestResult.ok
          ? `No published GitHub release found for ${repo}.`
          : latestResult.message,
      );
    }

    this.cachedRelease = release;
    this.cachedAt = Date.now();
    return release;
  }

  private async githubApi<T>(
    url: string,
  ): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
    const res = await fetch(url, {
      headers: this.githubRequestHeaders('application/vnd.github+json'),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const body = (await res.json()) as { message?: string };
        detail = body?.message ? `: ${body.message}` : '';
      } catch {
        /* ignore non-JSON error bodies */
      }

      const repo = this.githubRepo();
      const message =
        res.status === 404
          ? `GitHub release not found for ${repo}. If the repository is private, set GITHUB_TOKEN so the updater can read Releases.`
          : `GitHub API ${res.status}${detail}`;
      return { ok: false, status: res.status, message };
    }

    return { ok: true, data: (await res.json()) as T };
  }

  private pickLatestPublishedRelease(releases: GitHubRelease[]): GitHubRelease | null {
    if (!Array.isArray(releases) || releases.length === 0) return null;

    const published = releases.filter((release) => release && !release.draft);
    const withInstaller = published.filter((release) => this.findInstallerAsset(release));
    const stable = (withInstaller.length ? withInstaller : published).filter(
      (release) => !release.prerelease,
    );
    const pool = stable.length ? stable : withInstaller.length ? withInstaller : published;

    return (
      pool.slice().sort((a, b) => {
        const byVersion = this.compareVersions(
          this.normalizeVersion(b.tag_name),
          this.normalizeVersion(a.tag_name),
        );
        if (byVersion !== 0) return byVersion;
        return String(b.published_at || '').localeCompare(String(a.published_at || ''));
      })[0] ?? null
    );
  }

  private findInstallerAsset(release: GitHubRelease): GitHubReleaseAsset | null {
    const version = this.normalizeVersion(release.tag_name);
    const expectedName = `DNT-Dental-Main-Clinic-Setup-v${version}.exe`;
    const exact = release.assets.find((a) => a.name === expectedName);
    if (exact) return exact;

    return (
      release.assets.find((a) =>
        /^DNT-Dental-Main-Clinic-Setup-v.+\.exe$/i.test(a.name),
      ) ?? null
    );
  }

  private async verifyInstallerChecksum(
    installerPath: string,
    installerFileName: string,
    release: GitHubRelease,
  ): Promise<void> {
    const checksumAssetName = `${installerFileName}.sha256`;
    const checksumAsset = release.assets.find((a) => a.name === checksumAssetName);
    if (!checksumAsset) {
      this.logger.warn(`No checksum asset ${checksumAssetName} on release; skipping verification.`);
      return;
    }

    const res = await fetch(checksumAsset.browser_download_url, {
      headers: this.githubRequestHeaders('application/octet-stream'),
    });
    if (!res.ok) {
      throw new InternalServerErrorException('Failed to download installer checksum.');
    }

    const expected = (await res.text()).trim().toLowerCase().split(/\s+/)[0];
    const actual = crypto.createHash('sha256').update(fs.readFileSync(installerPath)).digest('hex');
    if (expected !== actual) {
      fs.unlinkSync(installerPath);
      throw new InternalServerErrorException('Downloaded installer failed checksum verification.');
    }
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
