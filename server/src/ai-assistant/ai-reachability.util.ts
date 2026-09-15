import {
  classifyReachabilityFailure,
  isExternalFetchFailure,
} from '../sync/online-reachability.util';

export const AI_FETCH_TIMEOUT_MS = 55_000;

export const AI_UNREACHABLE_MESSAGE =
  'AI Assistant cannot reach the AI service. Check the internet connection and try again.';

export const AI_TIMEOUT_MESSAGE =
  'AI Assistant timed out waiting for a reply. Check the internet connection and try again.';

export const AI_TLS_MESSAGE =
  'Could not establish a secure connection to the AI service. Check the internet connection.';

export const AI_BUSY_MESSAGE = 'AI Assistant is busy. Try again in a moment.';

export const AI_UNAUTHORIZED_MESSAGE =
  'AI Assistant is not authorized. Ask your administrator to check the configuration.';

export const AI_PROVIDER_ERROR_MESSAGE =
  'The AI service had an error. Try again in a moment.';

export const AI_EMPTY_RESPONSE_MESSAGE = 'The AI service returned an empty reply. Try again.';

export const AI_UNREADABLE_RESPONSE_MESSAGE =
  'The AI service returned an unreadable response. Try again.';

export function describeAiReachabilityError(err: unknown): string {
  const kind = classifyReachabilityFailure(err);
  if (kind === 'timeout') return AI_TIMEOUT_MESSAGE;
  if (kind === 'tls') return AI_TLS_MESSAGE;
  return AI_UNREACHABLE_MESSAGE;
}

export function describeAiHttpStatus(status: number): string {
  if (status === 401 || status === 403) return AI_UNAUTHORIZED_MESSAGE;
  if (status === 429) return AI_BUSY_MESSAGE;
  if (status >= 500) return AI_PROVIDER_ERROR_MESSAGE;
  return AI_PROVIDER_ERROR_MESSAGE;
}

export function mapAiFetchFailure(err: unknown): string {
  if (isExternalFetchFailure(err)) return describeAiReachabilityError(err);
  return AI_UNREACHABLE_MESSAGE;
}
