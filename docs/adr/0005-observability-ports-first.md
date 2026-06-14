# ADR 0005: Observability Ports First

## Status

Accepted.

## Context

The game will need to understand user frustration, errors, performance, funnels, retention, and balance. At the same time, Phase 1 should not add production observability vendors or infrastructure.

## Decision

Define observability ports from the beginning:

- `TelemetryPort`
- `AnalyticsPort`
- `ErrorReportingPort`

Use console/local adapters in Phase 1. Add OpenTelemetry, Grafana, Sentry, PostHog, Datadog, or a database-backed analytics adapter later without changing domain/game logic.

Every analytics event must include `eventVersion`.

## Consequences

- Observability is not an afterthought.
- The app avoids vendor lock-in.
- Phase 1 remains lightweight.
- We need event taxonomy discipline from the start.

## Alternatives Considered

- Add Datadog/Sentry/PostHog immediately: powerful, but too much external setup for Phase 1.
- Add no observability until later: faster now, but likely creates blind spots and retrofit work.
- Log everything ad hoc: noisy, risky, and hard to dashboard.
