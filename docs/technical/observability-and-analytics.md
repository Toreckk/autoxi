# Observability and Analytics

Observability should be designed in from the first slice, but implemented in layers so it does not slow down the game foundation.

## Recommendation

Use a ports/adapters approach:

- `TelemetryPort` for engineering telemetry: timing, counters, structured logs.
- `AnalyticsPort` for product/game events: funnels, drop-off, balancing, player behavior.
- `ErrorReportingPort` for client and server exceptions.
- `SessionReplayPort` later for opt-in beta session replay.

Phase 1 uses console/local adapters only. Do not set up Sentry, PostHog, Grafana, Datadog, OpenTelemetry Collector, or other external observability infrastructure yet.

## Tooling Strategy

Phase 1:

- structured console logging,
- React ErrorBoundary,
- NestJS global exception filter,
- console telemetry adapter,
- console analytics adapter,
- console error-reporting adapter,
- optional `analytics_events` table.

Later:

- OpenTelemetry for vendor-neutral telemetry,
- Grafana/Tempo/Loki/Prometheus for open dashboards,
- Sentry for error reporting,
- PostHog for product analytics/session replay/experiments,
- Datadog if a paid all-in-one platform becomes worthwhile.

## Why Not "As Much Data As Possible" Literally

Collect rich data, but do it intentionally. Too much unstructured telemetry becomes expensive, noisy, and risky.

Rules:

- Define an event taxonomy before emitting events everywhere.
- Every analytics event must have an `eventVersion`.
- Avoid PII unless absolutely necessary.
- Never log raw source player names in public/client telemetry.
- Never log source payloads in telemetry.
- Never log database URLs, tokens, auth secrets, or full request bodies by default.
- Use stable anonymous user/session IDs.
- Sample noisy events later if needed.
- Add retention policies before public release.
- Separate dev/internal telemetry from production telemetry.
- Add consent controls before session replay or detailed client analytics.
- Add analytics opt-out later.

## Ports

```ts
export type TelemetryAttributes = Record<string, string | number | boolean | null>;

export interface TelemetryPort {
  startSpan<A>(
    name: string,
    attributes: TelemetryAttributes,
    run: () => Promise<A>,
  ): Promise<A>;
  increment(name: string, value?: number, attributes?: TelemetryAttributes): void;
  histogram(name: string, value: number, attributes?: TelemetryAttributes): void;
  log(level: "debug" | "info" | "warn" | "error", message: string, attributes?: TelemetryAttributes): void;
}

export interface AnalyticsPort {
  identify(input: { anonymousId: string; userId?: string | null }): void;
  track(event: AnalyticsEvent): void;
  flush(): Promise<void>;
}

export interface ErrorReportingPort {
  captureException(error: unknown, context?: TelemetryAttributes): void;
  captureMessage(message: string, context?: TelemetryAttributes): void;
}
```

Keep these ports in an infrastructure-facing package or app layer, not in pure domain code. Pure domain functions can return facts that callers turn into analytics events.

## Event Versioning

Every analytics event must include:

```ts
type AnalyticsEvent = {
  eventName: string;
  eventVersion: number;
  anonymousId: string;
  userId?: string | null;
  sessionId: string;
  timestamp: string;
  route?: string | null;
  properties: Record<string, unknown>;
  appVersion?: string;
  environment: "local" | "development" | "staging" | "production";
};
```

## Phase 1 Analytics Events

Implement or stub:

- `app_started`
- `main_menu_viewed`
- `main_menu_option_clicked`
- `collection_viewed`
- `collection_cards_loaded`
- `collection_filter_changed`
- `collection_search_changed`
- `collection_sort_changed`
- `collection_page_changed`
- `card_clicked`
- `card_detail_opened`
- `card_detail_closed`
- `api_request_failed`
- `api_request_slow`
- `client_error_captured`

## Funnels

Phase 1 Collection funnel:

```text
app_started
-> main_menu_viewed
-> main_menu_option_clicked(Collection)
-> collection_viewed
-> collection_cards_loaded
-> collection_filter_changed or card_detail_opened
```

Future first-run funnel:

```text
app_started
-> main_menu_viewed
-> play_solo_clicked
-> run_started
-> formation_selected
-> captain_selected
-> initial_draft_completed
-> match_started
-> match_completed
-> scouting_window_opened
```

Future ranked funnel:

```text
app_started
-> play_online_ranked_clicked
-> matchmaking_started
-> match_started
-> match_completed
-> rank_result_viewed
```

## Optional Local Analytics Table

Optional Phase 1 table:

```text
analytics_events
- id
- event_name
- event_version
- anonymous_id
- user_id nullable
- session_id
- route nullable
- properties jsonb
- created_at
```

Adapters:

- `ConsoleAnalyticsAdapter`
- `DbAnalyticsAdapter` optional
- `NoopAnalyticsAdapter` for tests

## Dashboards Later

Phase 2 or early Phase 3 can add Grafana-compatible dashboards for:

- API health and uptime,
- request rate,
- error rate,
- p50/p95/p99 API latency,
- card query latency,
- Collection page load failures,
- Collection filter usage,
- empty-result rate.

Gameplay dashboards later:

- run starts and completions,
- run abandonment by stage,
- average run length,
- win/loss distribution,
- scouting rerolls per run,
- cards bought/sold by tier,
- card pick/sell/win rates,
- match simulation error rate,
- rank distribution,
- economy balance metrics.

## Privacy and Safety Checklist

Hard rules:

- No raw player names in telemetry.
- No source payloads in telemetry.
- No DB URLs/tokens in logs.
- No auth tokens in logs.
- No full request bodies by default.
- No raw imported data in analytics.
- No source mapping in public events.
- No alias risk notes in public API responses.
- No session replay before consent.
- No PII unless necessary.
- Add analytics opt-out later.

## Sources

- [OpenTelemetry docs](https://opentelemetry.io/docs/what-is-opentelemetry/)
- [Grafana docs](https://grafana.com/docs/grafana/latest/introduction/)
- [Datadog OpenTelemetry docs](https://docs.datadoghq.com/opentelemetry/)
- [PostHog docs](https://posthog.com/docs)
- [Sentry product docs](https://docs.sentry.io/product/)
