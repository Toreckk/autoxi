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

Transfermarkt is currently profile/baseline-ready but report-only. It profiles local CSVs, supports matching tests, and converts raw market/activity data into percentile baselines. Raw market value is never used as an overall rating.

EA, ClubElo, FBref, StatsBomb, FiveThirtyEight, and annual award adapters are skeletons. They never download data and currently report unavailable or unimplemented status until local files and dependency rules are approved.

7a0 manual references are comparison-only by default. They are not rating floors. Explicit manual anchors live in `sources/manual/iconicTargets.ts`.

## Rating Breakdown

Every card report now includes `formulaVersion`, `selectedDistributionStrategy`, raw/selected overall, season ability placeholders, World Cup performance rating, adjustments, caps, evidence summary, and comparison summary.

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
