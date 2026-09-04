import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export function resolveJwtSecret(config: ConfigService): string {
  const dataDir = config.get<string>('DNT_DATA_DIR');
  if (dataDir) {
    const file = path.join(path.resolve(dataDir), 'config', 'jwt.secret');
    if (fs.existsSync(file)) {
      const fromFile = fs.readFileSync(file, 'utf-8').trim();
      if (fromFile) return fromFile;
    }
  }
  return config.get<string>('JWT_SECRET') || 'dev-secret';
}
