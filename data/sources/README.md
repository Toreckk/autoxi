# Rating Lab Source Layout

Local source data lives under `data/sources/` and is intentionally ignored by git.

Expected default paths:

- `fjelstul-worldcup/data-csv/`: required Fjelstul World Cup CSV source.
- `transfermarkt/`: optional local Transfermarkt exports for profiling, matching, percentile baselines, and high-confidence RAW_EVIDENCE blending.
- `transfermarkt-overlay/`: generated local Transfermarkt enrichment rows that fill missing profiles/valuations without editing the base dump.
- `ea-fc-ratings/`: optional future EA/FC historical adapter input.
- `club-elo/`: optional future club-strength source.
- `fbref-overlay/`: optional future FBref player-season stats. Live extraction is disabled for now; missing files are fine.
- `sofascore/`: optional future SofaScore source. It is skeleton-only in the current rating lab.
- `statsbomb-open-data/`: optional future open-data source.
- `fivethirtyeight/`: optional future World Cup model source.
- `annual-awards/`: optional future Ballon d'Or and annual award source.

The default command searches for Fjelstul at:

```text
data/sources/fjelstul-worldcup/data-csv
```

Override paths with env vars such as `RATING_LAB_FJELSTUL_SOURCE_DIR` and `RATING_LAB_TRANSFERMARKT_SOURCE_DIR`, or CLI flags such as `--fjelstul-source-dir` and `--transfermarkt-source-dir`.

7a0 manual references are built into the spike as comparison-only calibration targets. They do not directly drive final ratings by default.

## Rating Formula Config

The rating-lab tuning surface is:

```text
data/rating-formulas/pre-phase-1b-raw-evidence.json
```

It is validated with Zod before each run. Use it to tune Transfermarkt/Fjelstul blend weights, the four-year World Cup cycle window, annual Transfermarkt signal weights, missing-season rules, availability/low-minutes rules, caps, distribution buckets, and local preview name display.

Run an alternate formula file with:

```bash
pnpm db:rating-lab -- --formula-config data/rating-formulas/my-test.json
```

Transfermarkt high-confidence matches can affect ratings. MEDIUM/LOW matches remain report-only by default. EA, ClubElo, StatsBomb, FiveThirtyEight, FBref, SofaScore, and annual awards remain available/profiled/skeleton sources until separately implemented.

## Local Enrichment

Generated enrichment data stays local and ignored. The rating lab can export Transfermarkt candidates, expand coverage from local/cacheable Transfermarkt data, then reload normalized overlay CSVs:

```bash
pnpm db:rating-lab:export-enrichment -- --scope priority-elite --max-requests 100
pnpm db:transfermarkt:coverage
pnpm db:transfermarkt:enrich -- --round round-1-core --dry-run
pnpm db:transfermarkt:enrich -- --round round-1-core
pnpm db:transfermarkt:enrich -- --round round-1-core --world-cup-year 2002 --max-leagues 1
pnpm db:transfermarkt:merge-preview
pnpm db:rating-lab:loop
```

Set `TRANSFERMARKT_USER_AGENT` or `USER_AGENT` before non-dry live passes. The scraper caches squads, requests sequentially, and stops on `403`/`429`.

Expected generated layout:

- `data/work/missing-player-enrichment.jsonl`
- `data/sources/transfermarkt-overlay/players_overlay.csv`
- `data/sources/transfermarkt-overlay/player_valuations_overlay.csv`
- `data/sources/identity/provider_player_links.csv`
- `data/sources/enrichment/enrichment_needs_review.csv`
- `data/sources/enrichment/enrichment_status.csv`

Provider links with `review_status` of `auto_approved` or `manual_approved` may be used before fuzzy matching. `needs_review` and `rejected` links are reported but ignored by default.
