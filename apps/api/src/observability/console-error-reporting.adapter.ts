import { Injectable } from "@nestjs/common";
import type { ErrorReportingPort, TelemetryAttributes } from "@autoxi/domain";

@Injectable()
export class ConsoleErrorReportingAdapter implements ErrorReportingPort {
  captureException(error: unknown, context: TelemetryAttributes = {}): void {
    console.error(
      JSON.stringify({
        level: "error",
        message: "exception_captured",
        ...serializeError(error),
        ...context
      })
    );
  }

  captureMessage(message: string, context: TelemetryAttributes = {}): void {
    console.warn(JSON.stringify({ level: "warn", message: "message_captured", detail: message, ...context }));
  }
}

function serializeError(error: unknown): TelemetryAttributes {
  if (!(error instanceof Error)) {
    return { error: "Unknown error" };
  }

  const errorRecord = error as Error & {
    cause?: unknown;
    code?: unknown;
    detail?: unknown;
    table?: unknown;
    column?: unknown;
  };
  const cause = serializeCause(errorRecord.cause);

  return {
    error: error.message,
    errorName: error.name,
    ...(cause ? { cause } : {}),
    ...(typeof errorRecord.code === "string" ? { dbCode: errorRecord.code } : {}),
    ...(typeof errorRecord.detail === "string" ? { dbDetail: errorRecord.detail } : {}),
    ...(typeof errorRecord.table === "string" ? { dbTable: errorRecord.table } : {}),
    ...(typeof errorRecord.column === "string" ? { dbColumn: errorRecord.column } : {})
  };
}

function serializeCause(cause: unknown): string | null {
  if (!cause) return null;
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  if (typeof cause === "object") {
    const message = (cause as { message?: unknown }).message;
    return typeof message === "string" ? message : JSON.stringify(cause);
  }
  return String(cause);
}
