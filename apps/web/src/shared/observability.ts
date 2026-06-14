import type { AnalyticsEnvironment, AnalyticsEvent, AnalyticsEventName } from "@autoxi/domain";

const anonymousIdKey = "autoxi.anonymousId";
const sessionId = crypto.randomUUID();

function getAnonymousId() {
  const existing = localStorage.getItem(anonymousIdKey);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(anonymousIdKey, next);
  return next;
}

function environment(): AnalyticsEnvironment {
  return import.meta.env.MODE === "production" ? "production" : "local";
}

class ConsoleAnalyticsAdapter {
  identify(input: { anonymousId: string; userId?: string | null }) {
    console.info("[analytics] identify", input);
  }

  track(eventName: AnalyticsEventName, properties: Record<string, unknown> = {}) {
    const event: AnalyticsEvent = {
      eventName,
      eventVersion: 1,
      anonymousId: getAnonymousId(),
      sessionId,
      timestamp: new Date().toISOString(),
      route: typeof properties.route === "string" ? properties.route : window.location.pathname,
      properties,
      environment: environment()
    };
    console.info("[analytics] track", event);
  }

  async flush() {
    return Promise.resolve();
  }
}

class ConsoleErrorReportingAdapter {
  captureException(error: unknown, context: Record<string, unknown> = {}) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[client-error]", { message, ...context });
    analytics.track("client_error_captured", { message, ...context });
  }

  captureMessage(message: string, context: Record<string, unknown> = {}) {
    console.warn("[client-message]", { message, ...context });
  }
}

export const analytics = new ConsoleAnalyticsAdapter();
export const errorReporting = new ConsoleErrorReportingAdapter();
