import { HttpException, HttpStatus } from '@nestjs/common';
import { isPayloadTooLargeError, PAYLOAD_TOO_LARGE_CODE, PAYLOAD_TOO_LARGE_MESSAGE } from '../http-payload.util';

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
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { message: 'Unexpected server error' } };
}
