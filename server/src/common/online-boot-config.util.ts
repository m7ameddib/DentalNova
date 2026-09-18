import { isWeakJwtSecret } from '../auth/jwt-payload.util';
import { isInsecureAiServiceSecret, onlineAiSecretBootError } from './ai-service-secret.util';

export const WEAK_JWT_SECRET_BOOT_ERROR =
  'Online deployment requires a strong JWT_SECRET environment variable (at least 32 characters, not a documented placeholder). ' +
  'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"';

export const MISSING_ADMIN_BOOT_ERROR =
  'Online production requires DIBNOVA_ADMIN_USERNAME and DIBNOVA_ADMIN_PASSWORD so clinics can be activated. ' +
  'These are server-side credentials for /dibnova-admin — they are never entered as an API key in the browser.';

export const MISSING_PLATFORM_SECRETS_BOOT_ERROR =
  'Online production requires PLATFORM_SECRETS_KEY (a unique secret, not JWT_SECRET) to encrypt trial passwords in platform.db.';

export const REUSED_PLATFORM_SECRETS_BOOT_ERROR =
  'PLATFORM_SECRETS_KEY must be different from JWT_SECRET.';

export function onlineBootConfigError(input: {
  jwtSecret?: string | null;
  geminiApiKey?: string | null;
  aiServiceSecret?: string | null;
  isProduction: boolean;
  adminUsername?: string | null;
  adminPassword?: string | null;
  platformSecretsKey?: string | null;
}): string | null {
  if (isWeakJwtSecret(input.jwtSecret)) {
    return WEAK_JWT_SECRET_BOOT_ERROR;
  }
  if (input.geminiApiKey?.trim() && isInsecureAiServiceSecret(input.aiServiceSecret)) {
    return onlineAiSecretBootError();
  }
  if (!input.isProduction) return null;

  if (!input.adminUsername?.trim() || !input.adminPassword) {
    return MISSING_ADMIN_BOOT_ERROR;
  }
  const platformSecrets = input.platformSecretsKey?.trim() || '';
  if (!platformSecrets) {
    return MISSING_PLATFORM_SECRETS_BOOT_ERROR;
  }
  if (platformSecrets === (input.jwtSecret?.trim() || '')) {
    return REUSED_PLATFORM_SECRETS_BOOT_ERROR;
  }
  return null;
}
