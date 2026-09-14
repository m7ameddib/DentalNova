/** Historical public default — never allow this in production Online AI. */
export const PUBLIC_DEFAULT_AI_SERVICE_SECRET = 'DentalNova.AI.Proxy.v1';

const INSECURE_AI_SERVICE_SECRETS = new Set([
  PUBLIC_DEFAULT_AI_SERVICE_SECRET,
  'REPLACE_WITH_UNIQUE_AI_PROXY_SECRET',
]);

export function isInsecureAiServiceSecret(value: string | undefined | null): boolean {
  const trimmed = value?.trim() || '';
  return !trimmed || INSECURE_AI_SERVICE_SECRETS.has(trimmed);
}

export function onlineAiSecretBootError(): string {
  return (
    'Online AI is enabled (GEMINI_API_KEY is set) but AI_SERVICE_SECRET is missing or not unique. ' +
    'If you do not need the AI assistant yet, leave GEMINI_API_KEY empty. ' +
    'Otherwise set a unique AI_SERVICE_SECRET (never DentalNova.AI.Proxy.v1 and never the example placeholder). ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
  );
}
