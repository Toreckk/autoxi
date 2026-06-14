# Phase 1 Overview

Phase 1 creates the first demoable vertical slice: a working Collection page backed by a Drizzle/PostgreSQL card database and NestJS API.

## Prerequisites

- Node.js `24.11.1`
- pnpm `10.24.0`
- Git
- A hosted PostgreSQL database, preferably Neon
- Local `.env.local` with private database URLs
- No Docker requirement

## Scope

Build:

- pnpm monorepo structure,
- `packages/domain` shared card types, Zod schemas, and pure helpers,
- `packages/db` Drizzle schema, client factory, migration config, and seed helpers,
- NestJS API with health and card query endpoints,
- curated fictional seed data,
- public-safe player identity and alias separation,
- React/Vite frontend with main menu and Collection route,
- reusable material-style player card components,
- filters, sorting, pagination, loading, empty, and error states,
- observability ports with console adapters,
- React ErrorBoundary and NestJS global exception filter.

Do not build:

- gameplay simulation,
- scouting shop,
- async matchmaking,
- rankings,
- runs,
- collection discovery,
- auth,
- Tauri,
- Steamworks,
- Docker,
- Sentry/PostHog/Grafana/Datadog/OpenTelemetry collector.

## Objectives

By the end of Phase 1:

1. A developer can install dependencies and run API/web locally.
2. Drizzle migrations can create the Phase 1 card schema in hosted PostgreSQL.
3. The seed script can populate 30-100 fictional cards.
4. `GET /health` works.
5. `GET /cards`, `GET /cards/:id`, and `GET /cards/meta/filters` work.
6. Public card responses never expose raw source names or private source mappings.
7. The frontend shows a main menu.
8. The Collection page loads, filters, sorts, paginates, and opens card details.
9. Card visuals follow the material-card design direction.
10. Basic telemetry, analytics, and error-reporting ports are wired to console adapters.

## Completion Checks

Phase 1 is complete when these checks pass:

```powershell
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm db:migrate
pnpm db:seed
pnpm dev:api
pnpm dev:web
```

Manual verification:

- `GET http://localhost:3000/health` returns ok.
- `GET http://localhost:3000/cards` returns paginated public cards.
- `GET http://localhost:3000/cards/:id` returns one public card.
- `GET http://localhost:3000/cards/meta/filters` returns filter metadata.
- Public responses do not contain private fields such as `rawName`, `sourceExternalId`, `rawPayloadJson`, or `sourceImportId`.
- `http://localhost:5173` shows the menu.
- `/collection` shows cards and supports the required filters.
- Card detail drawer opens and closes.
- Console telemetry logs request timing, API failures, route views, and Collection interactions.
- No raw player names, source payloads, tokens, or DB URLs appear in logs or analytics events.

## Phase 1 SLO Targets

These are development targets, not production SLAs:

- `GET /health` p95 under 100ms locally/dev.
- `GET /cards` p95 under 300ms for normal filtered queries.
- `GET /cards/:id` p95 under 150ms.
- Collection first useful render under 2s on the target dev machine.
- Collection filter interaction remains responsive with 100 cards.
- Card grid does not run full animations on every card simultaneously.
- API error rate stays under 1% during normal local/dev usage.
- No unhandled client errors on main menu or Collection route.
- Seed script can rebuild Phase 1 data in under 30s.
