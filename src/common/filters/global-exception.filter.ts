import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const details =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // const errorCode =
    //   exception instanceof HttpException
    //     ? `ERROR_${status}`
    //     : 'INTERNAL_SERVER_ERROR';

    response.status(status).json({
      status: false,
      statusCode: status,
      message: message,
      data: null,
      errors: typeof details === 'string' ? details : details['message'],
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(process.env.NODE_ENV === 'development' && {
        error: exception instanceof Error ? exception.stack : null,
      }),
    });
  }
}
