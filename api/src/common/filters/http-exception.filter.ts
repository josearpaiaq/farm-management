import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

export interface FieldError {
  field: string;
  message: string;
}

const ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'bad_request',
  [HttpStatus.UNAUTHORIZED]: 'unauthorized',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'validation_error',
  [HttpStatus.TOO_MANY_REQUESTS]: 'too_many_requests',
};

// Single consistent error shape across the API (see plan, API Conventions):
// { statusCode, error, message, details? } — details only on validation.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let details: FieldError[] | undefined;

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const payload = body as {
          message?: string | string[];
          details?: FieldError[];
        };
        message = Array.isArray(payload.message)
          ? payload.message.join('; ')
          : (payload.message ?? exception.message);
        details = payload.details;
      }
    } else {
      // Unexpected error: log it with stack, never leak internals to clients.
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error: ERROR_CODES[status] ?? 'internal_error',
      message,
      ...(details ? { details } : {}),
    });
  }
}
