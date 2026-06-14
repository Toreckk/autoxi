import { Injectable } from "@nestjs/common";
import type { ErrorReportingPort, TelemetryAttributes } from "@autoxi/domain";

@Injectable()
export class ConsoleErrorReportingAdapter implements ErrorReportingPort {
  captureException(error: unknown, context: TelemetryAttributes = {}): void {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(JSON.stringify({ level: "error", message: "exception_captured", error: message, ...context }));
  }

  captureMessage(message: string, context: TelemetryAttributes = {}): void {
    console.warn(JSON.stringify({ level: "warn", message: "message_captured", detail: message, ...context }));
  }
}
