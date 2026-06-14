import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import type { ErrorReportingPort, TelemetryPort } from "@autoxi/domain";
import { ZodError } from "zod";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly telemetry: TelemetryPort,
    private readonly errors: ErrorReportingPort
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const response = ctx.getResponse<Response>();

    const isZod = exception instanceof ZodError;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isZod
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : isZod
          ? "Invalid request query"
          : "Internal server error";

    this.telemetry.increment("api.request.failed", 1, {
      method: request.method,
      path: request.path,
      status,
      requestId: request.requestId ?? null
    });

    if (status >= 500) {
      this.errors.captureException(exception, {
        method: request.method,
        path: request.path,
        requestId: request.requestId ?? null
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      requestId: request.requestId ?? null
    });
  }
}
