# Observability and Analytics

Observability should be designed in from the first slice, but implemented in layers so it does not slow down the game foundation.

## Recommendation

Use a ports/adapters approach:

- `TelemetryPort` for engineering telemetry: traces, metrics, structured logs.
- `AnalyticsPort` for product/game events: funnels, drop-off, balancing, player behavior.
- `ErrorReportingPort` for client and server exceptions.
- `SessionReplayPort` later for opt-in beta session replay.

Start with console/local adapters and OpenTelemetry-compatible instrumentation. Add Grafana-compatible dashboards once there is a backend and real API traffic. Keep the ports stable so we can move from a free stack to Datadog, Grafana Cloud, PostHog Cloud, Sentry, or another provider without rewriting game logic.

## Tooling Strategy

### Engineering Observability

Use OpenTelemetry as the main standard. OpenTelemetry is open source and vendor/tool agnostic, and covers generation, collection, and export of traces, metrics, and logs. It also gives us a path to export to open-source tools or commercial platforms later.

Free/open-source first:

- OpenTelemetry SDKs for Node/NestJS and browser where appropriate.
- OpenTelemetry Collector later when deployment exists.
- Grafana for dashboards.
- Prometheus or Grafana Mimir for metrics.
- Loki for logs.
- Tempo for traces.

Paid later:

- Datadog can ingest OpenTelemetry-instrumented application data, so using OpenTelemetry now keeps that migration realistic.

### Product and Game Analytics

Grafana can visualize metrics and query databases, but it is not the whole product analytics story. For player frustration, drop-off, funnels, retention, cohorts, and session replay, use a product analytics layer.

Good first options:

- PostHog for product analytics, feature flags, experiments, session replay, surveys, and error tracking.
- A custom `analytics_events` table for early local development if we want zero SaaS dependency.
- Later ClickHouse or a managed warehouse if event volume grows.

Recommendation: implement the `AnalyticsPort` first, then choose an adapter when the first real playtest starts. For the Collection-only slice, a console adapter plus optional database event sink is enough.

## Why Not "As Much Data As Possible" Literally

Collect rich data, but do it intentionally. Too much unstructured telemetry becomes expensive, noisy, and risky.

Rules:

- Define an event taxonomy before emitting events everywhere.
- Avoid PII unless absolutely necessary.
- Never log raw source player names in public/client telemetry.
- Never log secrets, database URLs, auth tokens, or full request bodies by default.
- Use stable anonymous user/session IDs.
- Sample noisy events.
- Add retention policies.
- Separate dev/internal telemetry from production telemetry.
- Add consent controls for session replay and detailed client analytics, especially before public release.

## Ports

Example TypeScript shape:

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
  identify(input: { anonymousId: string; userId?: string }): void;
  track(event: GameAnalyticsEvent): void;
  flush(): Promise<void>;
}

export interface ErrorReportingPort {
  captureException(error: unknown, context?: TelemetryAttributes): void;
  captureMessage(message: string, context?: TelemetryAttributes): void;
}
```

Keep these ports in an infrastructure-facing package or app layer, not in pure domain code. Pure domain functions can return facts that callers turn into analytics events.

## First Event Taxonomy

### App and Session

- `app_started`
- `session_started`
- `session_ended`
- `route_viewed`
- `client_error`
- `api_error`

### Collection

- `collection_viewed`
- `collection_search_changed`
- `collection_filter_changed`
- `collection_sort_changed`
- `collection_page_changed`
- `card_detail_opened`
- `card_detail_closed`
- `collection_empty_results_seen`
- `collection_load_failed`

### Performance

- `api_request_duration`
- `api_request_failed`
- `cards_query_duration`
- `cards_query_result_count`
- `frontend_route_load_duration`
- `card_grid_render_duration`

### Later Gameplay

- `run_started`
- `formation_selected`
- `captain_selected`
- `initial_draft_completed`
- `match_started`
- `match_completed`
- `scouting_window_opened`
- `scouting_card_bought`
- `scouting_card_sold`
- `scouting_reroll_clicked`
- `scouting_freeze_toggled`
- `scout_xp_bought`
- `run_completed`
- `run_abandoned`

## Dashboards

### Phase 1 Dashboard

- API health and uptime.
- Request rate.
- Error rate.
- p50/p95/p99 API latency.
- Card query latency.
- Collection page load failures.
- Collection filter usage.
- Empty-result rate.

### Playtest Dashboard

- Session count.
- Main menu to Collection conversion.
- Collection interactions per session.
- Card detail opens.
- Client errors by route.
- API errors by endpoint.
- Slow frontend route loads.

### Gameplay Dashboard Later

- Run starts and completions.
- Run abandonment by stage.
- Average run length.
- Win/loss distribution.
- Scouting rerolls per run.
- Cards bought/sold by tier.
- Match simulation error rate.
- Rank distribution.
- Economy balance metrics.

## Phase Placement

Add the foundation in Phase 1:

- define ports,
- add no-op/console adapters,
- add request IDs/correlation IDs,
- add structured logging,
- instrument health and card endpoints,
- emit Collection page analytics events.

Add real local dashboards in Phase 2 or early Phase 3:

- OpenTelemetry Collector when deployment shape is clearer,
- Grafana dashboards,
- persisted analytics event sink,
- frontend error reporting.

Add session replay and deeper product analytics during closed alpha/playtests:

- consent/opt-in controls,
- redaction rules,
- replay sampling,
- frustration signals such as repeated failed clicks, rage clicks, rapid quit after match, repeated rerolls, or abandoned runs.

## Sources

- [OpenTelemetry docs](https://opentelemetry.io/docs/what-is-opentelemetry/)
- [Grafana docs](https://grafana.com/docs/grafana/latest/introduction/)
- [Datadog OpenTelemetry docs](https://docs.datadoghq.com/opentelemetry/)
- [PostHog docs](https://posthog.com/docs)
- [Sentry product docs](https://docs.sentry.io/product/)
