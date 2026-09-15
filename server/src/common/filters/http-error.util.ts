import { HttpException, HttpStatus } from '@nestjs/common';
import { isPayloadTooLargeError, PAYLOAD_TOO_LARGE_CODE, PAYLOAD_TOO_LARGE_MESSAGE } from '../http-payload.util';
import { isExternalFetchFailure } from '../../sync/online-reachability.util';

export const EXTERNAL_UNREACHABLE_CODE = 'EXTERNAL_UNREACHABLE';
export const EXTERNAL_UNREACHABLE_MESSAGE =
  'Could not reach an external service. Check the internet connection and try again.';

export const DATABASE_BUSY_CODE = 'DATABASE_BUSY';
export const DATABASE_BUSY_MESSAGE = 'The clinic database is busy. Try again in a moment.';

export const DATABASE_CONSTRAINT_CODE = 'DATABASE_CONSTRAINT';
export const DATABASE_CONSTRAINT_MESSAGE = 'This change conflicts with existing clinic records.';

export const DATABASE_ERROR_CODE = 'DATABASE_ERROR';
export const DATABASE_ERROR_MESSAGE =
  'The clinic database could not complete this request. Try again, or restore from a backup if this keeps happening.';

function sqliteCode(exception: unknown): string | null {
  if (!exception || typeof exception !== 'object') return null;
  const rec = exception as { code?: unknown; message?: unknown };
  if (typeof rec.code === 'string' && rec.code.startsWith('SQLITE_')) return rec.code;
  const message = String(rec.message || '');
  const match = message.match(/SQLITE_[A-Z0-9]+/);
  return match ? match[0] : null;
}

function httpErrorFromSqlite(code: string): { status: number; body: Record<string, unknown> } {
  if (code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED' || code === 'SQLITE_PROTOCOL') {
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      body: { message: DATABASE_BUSY_MESSAGE, code: DATABASE_BUSY_CODE },
    };
  }
  if (code.startsWith('SQLITE_CONSTRAINT')) {
    return {
      status: HttpStatus.CONFLICT,
      body: { message: DATABASE_CONSTRAINT_MESSAGE, code: DATABASE_CONSTRAINT_CODE },
    };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: { message: DATABASE_ERROR_MESSAGE, code: DATABASE_ERROR_CODE },
  };
}

export function httpErrorFromUnknown(exception: unknown): { status: number; body: Record<string, unknown> } {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const body =
      typeof raw === 'string' ? { message: raw } : { ...(raw as Record<string, unknown>) };
    return { status, body };
  }
  if (isPayloadTooLargeError(exception)) {
    return {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      body: { message: PAYLOAD_TOO_LARGE_MESSAGE, code: PAYLOAD_TOO_LARGE_CODE },
    };
  }
  const sqlite = sqliteCode(exception);
  if (sqlite) return httpErrorFromSqlite(sqlite);
  if (isExternalFetchFailure(exception)) {
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      body: { message: EXTERNAL_UNREACHABLE_MESSAGE, code: EXTERNAL_UNREACHABLE_CODE },
    };
  }
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { message: 'Unexpected server error' } };
}
