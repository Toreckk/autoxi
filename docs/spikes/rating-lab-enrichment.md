# Rating Lab Enrichment

The rating lab has a local-only enrichment layer for players whose downloaded Transfermarkt CSV dump is incomplete. It is designed for old World Cup data that becomes stable after one enrichment pass, plus future refreshes for new tournaments.

## Commands

```bash
pnpm db:rating-lab:export-enrichment -- --scope priority-elite --max-requests 100
pnpm db:transfermarkt:coverage
pnpm db:transfermarkt:enrich -- --round round-1-core --dry-run
pnpm db:transfermarkt:enrich -- --round round-1-core
pnpm db:transfermarkt:merge-preview
pnpm db:rating-lab:loop
```

The old Python bridge and external command adapter were removed after FBref live extraction repeatedly hit 403/Cloudflare blocks. Transfermarkt enrichment now lives in the TypeScript `@autoxi/scrapers` workspace package. It writes local overlay CSVs and review reports, and never mutates the base Transfermarkt dump.

## Local Data Contract

Requests are JSONL at:

```txt
data/work/missing-player-enrichment.jsonl
```

Generated outputs remain ignored:

```txt
data/sources/transfermarkt-overlay/
data/sources/identity/
data/sources/enrichment/
```

Provider links use:

```csv
subject_provider,subject_id,target_provider,target_id,player_name,nation_code,world_cup_year,confidence,link_method,evidence,review_status
```

Only `auto_approved` and `manual_approved` links are used by default. `needs_review` links appear in reports but do not affect matching.

## Export Behavior

The exporter detects:

- missing Transfermarkt matches
- local Transfermarkt IDs found outside `players.csv`
- missing profile or valuation rows
- low signal/low confidence matches
- elite, award, high-delta, or generated-only important cards

It writes candidate and local-ID discovery reports, then dedupes Transfermarkt candidates by provider/player. Batch flags include `--max-requests`, `--min-priority`, `--only-provider`, `--only-category`, `--scope`, and `--dry-run`.

## Rating Integration

Transfermarkt overlays immediately improve the existing Transfermarkt source because they fill missing profile and valuation evidence. FBref and SofaScore are skeleton/report-only: they surface source availability and future work, but perform no live requests and do not affect overall ratings.

No production runtime path runs scraping or imports external extractor internals.
