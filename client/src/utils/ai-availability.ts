export type AiUiState = 'loading' | 'ready' | 'not-configured' | 'offline';

/** Online product with browser fallback Offline must not pretend Gemini is reachable. */
export function resolveAiUiState(args: {
  fallbackOffline: boolean;
  configured?: boolean;
}): AiUiState {
  if (args.fallbackOffline) return 'offline';
  if (args.configured === true) return 'ready';
  if (args.configured === false) return 'not-configured';
  return 'loading';
}

export function isAiComposerEnabled(state: AiUiState, isBusy: boolean): boolean {
  if (isBusy || state === 'offline') return false;
  return true;
}
