import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { TelemetryPort } from "@autoxi/domain";

export function requestLoggingMiddleware(telemetry: TelemetryPort) {
  return (request: Request & { requestId?: string }, response: Response, next: NextFunction) => {
    const started = performance.now();
    const requestId = randomUUID();
    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);

    response.on("finish", () => {
      const duration = performance.now() - started;
      telemetry.histogram("api.request.duration_ms", duration, {
        method: request.method,
        path: request.path,
        status: response.statusCode,
        requestId
      });

      telemetry.log(response.statusCode >= 500 ? "error" : "info", "api_request_completed", {
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Math.round(duration),
        requestId
      });
    });

    next();
  };
}
