import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Normalizes all thrown errors into a consistent { message, error, details? }
 * JSON body so the client can render friendly validation messages.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const normalized =
        typeof body === 'string'
          ? { message: body }
          : (body as Record<string, unknown>);
      response.status(status).json({ ...normalized });
      return;
    }

    // eslint-disable-next-line no-console
    console.error(exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: 'Unexpected server error' });
  }
}
