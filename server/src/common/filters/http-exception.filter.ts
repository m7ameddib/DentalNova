import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { Response } from 'express';
import { httpErrorFromUnknown } from './http-error.util';

/**
 * Normalizes all thrown errors into a consistent { message, error, details? }
 * JSON body so the client can render friendly validation messages.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const { status, body } = httpErrorFromUnknown(exception);

    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error(exception);
    }

    response.status(status).json({ ...body });
  }
}
