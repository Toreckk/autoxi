# Transfermarkt Enrichment

Transfermarkt enrichment is owned by `@autoxi/scrapers`. It is local tooling, not production API code.

## Flow

```bash
pnpm db:rating-lab:export-enrichment -- --scope priority-elite --max-requests 100
pnpm db:transfermarkt:coverage
pnpm db:transfermarkt:enrich -- --round round-1-core --dry-run
pnpm db:transfermarkt:enrich -- --round round-1-core
pnpm db:transfermarkt:enrich -- --round round-1-core --world-cup-year 2002 --max-leagues 1
pnpm db:transfermarkt:merge-preview
pnpm db:rating-lab:loop
```

The enrichment package reads the latest rating-lab Transfermarkt candidate report, limits expansion to World Cup years by default, scans configured league/season cache files, fetches only cache misses on non-dry runs, scores player matches, auto-approves only unique high-confidence matches, and writes uncertain rows to review reports.

Live Transfermarkt passes require a normal User-Agent:

```env
TRANSFERMARKT_USER_AGENT="Mozilla/5.0 ..."
TRANSFERMARKT_RATE_LIMIT_MS=2500
```

The scraper uses ordinary headers, sequential requests, rate limiting, and cache reuse. It stops on `403` or `429` and does not attempt bypasses.

## Outputs

```txt
data/sources/transfermarkt-overlay/players_overlay.csv
data/sources/transfermarkt-overlay/player_valuations_overlay.csv
data/sources/identity/provider_player_links.csv
data/sources/enrichment/enrichment_needs_review.csv
data/sources/enrichment/enrichment_status.csv
data/import-reports/rating-lab/rating-lab-transfermarkt-coverage-summary-*.json
```

The base `data/sources/transfermarkt/` CSV dump is never edited by this flow. Overlay rows are merged by the existing Transfermarkt loader and surfaced in coverage reports/previews.

## Current Boundary

FBref live extraction is disabled because plain HTTP requests are blocked by 403/Cloudflare responses. FBref and SofaScore remain skeleton/report-only sources until a separate extraction strategy is approved.
