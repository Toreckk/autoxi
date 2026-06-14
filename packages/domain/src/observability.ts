export type TelemetryAttributes = Record<string, string | number | boolean | null>;

export interface TelemetryPort {
  startSpan<A>(
    name: string,
    attributes: TelemetryAttributes,
    run: () => Promise<A>
  ): Promise<A>;
  increment(name: string, value?: number, attributes?: TelemetryAttributes): void;
  histogram(name: string, value: number, attributes?: TelemetryAttributes): void;
  log(level: "debug" | "info" | "warn" | "error", message: string, attributes?: TelemetryAttributes): void;
}

export type AnalyticsEnvironment = "local" | "development" | "staging" | "production";

export type AnalyticsEvent = {
  eventName: string;
  eventVersion: number;
  anonymousId: string;
  userId?: string | null;
  sessionId: string;
  timestamp: string;
  route?: string | null;
  properties: Record<string, unknown>;
  appVersion?: string;
  environment: AnalyticsEnvironment;
};

export interface AnalyticsPort {
  identify(input: { anonymousId: string; userId?: string | null }): void;
  track(event: AnalyticsEvent): void;
  flush(): Promise<void>;
}

export interface ErrorReportingPort {
  captureException(error: unknown, context?: TelemetryAttributes): void;
  captureMessage(message: string, context?: TelemetryAttributes): void;
}

export const ANALYTICS_EVENT_NAMES = [
  "app_started",
  "main_menu_viewed",
  "main_menu_option_clicked",
  "collection_viewed",
  "collection_cards_loaded",
  "collection_filter_changed",
  "collection_search_changed",
  "collection_sort_changed",
  "collection_page_changed",
  "card_clicked",
  "card_detail_opened",
  "card_detail_closed",
  "api_request_failed",
  "api_request_slow",
  "client_error_captured"
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
