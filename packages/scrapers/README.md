# @autoxi/scrapers

Local data-generation tooling for Autoxi source enrichment.

This package is not production API/runtime code. It writes auditable overlay
files under `data/sources/*-overlay/` and reports under
`data/import-reports/rating-lab/`.

## Transfermarkt

The first implemented path is Transfermarkt coverage expansion:

- use rating-lab enrichment candidates as input
- scan configured league/season cache files
- fetch only cache misses on non-dry runs
- match squad players using name, nationality, birth date/year, position, and local ID evidence
- auto-approve only unique high-confidence matches
- write uncertain matches to `enrichment_needs_review.csv`
- write approved matches to overlay CSVs and `provider_player_links.csv`

The live scraper hook is intentionally conservative. It uses a provided
User-Agent, sequential requests, cache reuse, and stops on `403`/`429`. Tests do
not require internet.

## FBref

FBref live extraction is disabled for now. Cloudflare challenges currently make
plain HTTP extraction unreliable. FBref remains skeleton/report-only.

## SofaScore

SofaScore is a possible future enrichment source. It is skeleton-only in this
pass and performs no API calls.
