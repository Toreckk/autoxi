# Pre-Phase-1B Rating Lab

This is a private, file-based calibration lab for believable World Cup card ratings. It is not the production Phase 1B importer.

## Organization

- `cli/`: command entrypoints. These parse flags, call application use cases, print results, and handle errors.
- `application/`: orchestration use cases such as `runCalibration` and `runCalibrationLoop`.
- `domain/`: pure rating and evaluation logic. No filesystem, DB, CLI, process env, or source-adapter imports.
- `sources/`: Fjelstul CSV loading, manual fixtures, 7a0 comparison parsing, and external-source adapter skeletons.
- `reporting/`: JSON/CSV/HTML report and preview writers.
- `db-preview/`: preview-card selection, Neon-safe sizing, and guarded dev DB writes.

## Dependency Rules

- `cli/` can import `application/` and small CLI utilities.
- `application/` can import domain, sources, reporting, and DB preview modules.
- `domain/` may import `@autoxi/domain`, `domain/`, and pure local utilities only.
- `sources/` adapts external source shapes into domain/application models.
- `reporting/` writes outputs and must not decide ratings.
- `db-preview/` handles dev-preview sizing/writes and must not decide ratings.

The unit suite includes a guard that prevents `domain/` files from importing runtime IO or infrastructure layers.

## Where To Add Things

- New data source: `sources/<source-name>/` plus `sources/sourceAdapterTypes.ts`.
- New rating logic: `domain/rating/`.
- New quality check: `domain/evaluation/`.
- New report output: `reporting/`.
- New command: `cli/`, calling an `application/` use case.
- New DB preview behavior: `db-preview/`, behind explicit safety flags.

## Run

```bash
pnpm db:rating-lab
```

The default command resolves `data/sources/fjelstul-worldcup/data-csv`, ingests Fjelstul CSVs, resolves ratings, and writes JSON/CSV reports. It also reports source availability for optional sources.

For the full repeatable loop, run:

```bash
pnpm db:rating-lab:loop
```

The loop ingests sources, resolves ratings, writes reports, applies quality gates, generates the HTML preview, and prints the dev-preview DB estimate.

Individual commands are still available when you want to debug one stage:

```bash
pnpm db:rating-lab:gate
pnpm db:rating-lab:preview
pnpm db:rating-lab:profile-sources
pnpm db:rating-lab:profile-transfermarkt
pnpm db:rating-lab:export-enrichment
pnpm db:transfermarkt:coverage
pnpm db:transfermarkt:enrich
pnpm db:transfermarkt:merge-preview
```

Advanced formula override:

```bash
pnpm db:rating-lab -- --formula-config data/rating-formulas/my-test.json
```

Windows direct fallback:

```powershell
packages\db\node_modules\.bin\tsx.CMD packages\db\src\ingestion\rating-lab\cli\runRatingLab.ts
```

The preview command writes:

```txt
data/import-reports/rating-lab/rating-lab-preview.html
```

## Stage B Dev DB Preview

The dev DB preview command is intentionally guarded. Estimate-only is available:

```bash
pnpm db:rating-lab:write-dev-preview -- --report data/import-reports/rating-lab/latest-summary.json --max-cards 500 --dev-only --estimate-only
```

Actual writes use the ingested rating-lab summary, not the fictional seed set:

```bash
pnpm db:rating-lab:loop -- --source-dir data/sources/fjelstul-worldcup/data-csv --preset pre-phase-1b-calibration --seed 42 --write-dev-preview --dev-only --reset-rating-lab-preview
```

The writer resets only the `rating_lab_preview` source import and identities prefixed with `rating-lab-preview:`. It reuses or creates missing nations and World Cup editions, then inserts public-safe placeholder aliases, cards, and generated stat rows derived from the resolved overall.

Guardrails:

- default max cards: 500
- hard max cards: 1,000 unless explicitly overridden
- estimated rows gate: 5,000
- estimated storage gate: 25 MB
- no production mode
- no write without `--dev-only` and `--reset-rating-lab-preview`

## External Sources

The source registry is local-only. It tracks Fjelstul, Transfermarkt, EA historical, ClubElo, FBref, StatsBomb, FiveThirtyEight, annual awards, manual anchors, and 7a0 manual references.

Transfermarkt is now the first optional source that can affect RAW_EVIDENCE ratings. A HIGH-confidence Transfermarkt match with enough four-year cycle coverage becomes an applied source and blends with the Fjelstul World Cup fallback. MEDIUM/LOW Transfermarkt matches remain report-only by default.

The editable formula file is `data/rating-formulas/pre-phase-1b-raw-evidence.json`. Zod validates required fields, 0..1 weights, annual signal and season-window sums, 7a0 comparison-only safety, preview name flags, age thresholds, availability thresholds, and distribution buckets.

The default active source blend is:

- HIGH Transfermarkt: 65% Transfermarkt + 35% Fjelstul World Cup.
- Missing/MEDIUM/LOW Transfermarkt: 100% Fjelstul World Cup fallback.

The Transfermarkt window uses the previous World Cup cycle, for example `1979, 1980, 1981, 1982` for 1982. Under-age seasons are not expected, young players are not penalized for seasons they could not realistically play, and established players with missing expected seasons lose confidence rather than taking an automatic rating crash. Low minutes/appearances affect availability, confidence, and a small season-score penalty. There is no explicit injury inference in this pass.

EA, ClubElo, FBref, StatsBomb, FiveThirtyEight, and annual award adapters are skeletons. They never download data and currently report unavailable or unimplemented status until local files and dependency rules are approved.

## Enrichment Workflow

The enrichment layer is local-only tooling. It does not scrape during API startup and the TypeScript rating/domain layer does not import Python code. Transfermarkt enrichment lives in `@autoxi/scrapers` and writes auditable overlay files rather than mutating the base CSV dump.

Autoxi writes candidate requests:

```txt
data/work/missing-player-enrichment.jsonl
```

Export supports batching and dry runs:

```bash
pnpm db:rating-lab:export-enrichment -- --scope full-men-world-cup --dry-run
pnpm db:rating-lab:export-enrichment -- --max-requests 250 --min-priority 80
pnpm db:rating-lab:export-enrichment -- --only-provider transfermarkt
pnpm db:rating-lab:export-enrichment -- --only-category TRANSFERMARKT_PROFILE_MISSING
```

Transfermarkt coverage expansion is run separately:

```bash
pnpm db:transfermarkt:coverage
pnpm db:transfermarkt:enrich -- --round round-1-core --dry-run
pnpm db:transfermarkt:enrich -- --round round-1-core
pnpm db:transfermarkt:enrich -- --round round-1-core --world-cup-year 2002 --max-leagues 1
pnpm db:transfermarkt:merge-preview
pnpm db:rating-lab:loop
```

Non-dry Transfermarkt enrichment reads `TRANSFERMARKT_USER_AGENT` or `USER_AGENT` and uses sequential, rate-limited requests. It caches squad rows under `data/sources/transfermarkt-overlay/cache/` and stops on `403`/`429` without bypass attempts.

Before external search, the exporter builds a local Transfermarkt ID discovery index from `players.csv`, `player_valuations.csv`, `appearances.csv`, `game_lineups.csv`, `game_events.csv`, and `transfers.csv`. That catches players whose `player_id` appears in local events/lineups/transfers even when profile or valuation rows are missing.

The exporter writes:

- `rating-lab-enrichment-candidates-*.csv`
- `rating-lab-transfermarkt-local-id-discovery-*.csv`
- `data/work/missing-player-enrichment.jsonl`

Efficiency guardrails:

- dedupe requests by provider/player key where possible
- group repeated World Cup cards into one provider-player request
- skip request keys that already succeeded or are marked needs-review/rejected in `data/sources/enrichment/enrichment_status.csv`
- obey `--max-requests`, `--min-priority`, `--only-provider`, `--only-category`, and `--dry-run`

Transfermarkt overlay rows are loaded from `data/sources/transfermarkt-overlay/`. They fill missing profile fields and add valuation/profile rows without editing or committing the base CSV dump. FBref live extraction is disabled because plain HTTP extraction is currently blocked by 403/Cloudflare responses; the FBref adapter is skeleton/report-only and non-fatal. SofaScore is also skeleton-only for future investigation.

7a0 manual references are comparison-only by default. They are not rating floors. Explicit manual anchors live in `sources/manual/iconicTargets.ts`.

## Rating Breakdown

Every card report now includes `formulaVersion`, `formulaConfigPath`, `selectedDistributionStrategy`, raw/selected overall, source blend weights, Transfermarkt rating/coverage/confidence, World Cup rating, season-window diagnostics, caps, evidence summary, and comparison summary.

Reports also separate `debugRealName` from `publicDisplayName`. Local HTML/debug previews can show real/source names when `preview.showRealNamesInLocalPreview` is true. Public DTOs must continue to use public-safe display names and must not expose `debugRealName`.

The default formula preset is `pre-phase-1b-calibration`, with `RAW_EVIDENCE` selected. Alternative strategy configs can be reported before any percentile or elite-scarcity curve is allowed to affect final ratings.

## Visual Review Loop

1. Run `pnpm db:rating-lab:loop`.
2. Open `data/import-reports/rating-lab/rating-lab-preview.html`.
3. Review source availability, gate reasons, elite distribution, top cards by tournament, icons/heroes, generated-only outliers, anomalies, and 7a0 comparison deltas.
4. Tune formula config, manual anchors, source matching, caps, pairwise checks, or parsing.
5. Re-run the loop until hard failures are zero and warnings are explainable.

## Generated Rating Caps

Generated-only ratings are capped conservatively when there is not enough individual signal:

- no appearance/goals/awards: max 78
- appeared, no goals/awards, not a clear starter: max 84
- no strong individual signal: max 88

Award floors, manual floors, and future high-confidence external ratings can exceed these caps.
