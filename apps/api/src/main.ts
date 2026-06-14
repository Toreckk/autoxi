import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module.js";
import { GlobalExceptionFilter } from "./observability/global-exception.filter.js";
import { ConsoleErrorReportingAdapter } from "./observability/console-error-reporting.adapter.js";
import { ConsoleTelemetryAdapter } from "./observability/console-telemetry.adapter.js";
import { requestLoggingMiddleware } from "./observability/request-logging.middleware.js";
import { getCorsOrigins, isCorsOriginAllowed, loadApiEnv } from "./runtime/env.js";

async function bootstrap() {
  loadApiEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const telemetry = app.get(ConsoleTelemetryAdapter);
  const errors = app.get(ConsoleErrorReportingAdapter);
  const corsOrigins = getCorsOrigins();

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      callback(null, isCorsOriginAllowed(origin));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false
  });
  app.use(requestLoggingMiddleware(telemetry));
  app.useGlobalFilters(new GlobalExceptionFilter(telemetry, errors));

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);

  telemetry.log("info", "api_started", {
    port,
    corsOrigins: corsOrigins.join(","),
    localLoopbackCors: process.env.NODE_ENV !== "production"
  });
}

bootstrap().catch((error) => {
  console.error("[api] failed to start", error);
  process.exitCode = 1;
});
