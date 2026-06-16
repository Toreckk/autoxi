# Pre-Phase-1B Rating Lab

This spike exists to tune believable World Cup card overall ratings before Phase 1B commits to a production ingestion path. It is file-based, deterministic, private to development, and must not write to the production catalog.

## Calibration Loop

The intended loop is:

```text
Fjelstul source data
  -> private rating lab
  -> reports and automated gates
  -> tuning / algorithm improvements
  -> optional dev DB sample import
  -> Collection UI eye test
  -> promote stable logic into Phase 1B
```

Overall rating is the primary target. Hidden stats are generated to explain the visible overall and support future gameplay checks.

## Source Priority

The resolver checks sources in this order: `MANUAL_CURATED`, `EA_HISTORICAL`, `RETRO_REFERENCE`, `FIVETHIRTYEIGHT_WORLD_CUP`, `STATSBOMB_WORLD_CUP`, `SEVEN_A_ZERO_COMPARISON`, then `FJELSTUL_GENERATED`.

Manual curation provides protective floors, not exact ratings. Optional EA-style, retro, 538, StatsBomb, and local 7a0 JSON inputs are developer-only research/calibration signals until licensing and permission questions are resolved. 7a0 manual references are curated screenshot/user-provided comparison values and are reported separately from optional local JSON comparisons.

## Code Organization

The rating lab is organized by dependency direction:

- `cli/` parses flags and calls application use cases.
- `application/` orchestrates calibration runs.
- `domain/rating/` contains pure rating and stat logic.
- `domain/evaluation/` contains pure benchmark, anomaly, pairwise, and gate checks.
- `sources/` contains source-specific parsing and matching.
- `reporting/` writes JSON, CSV, and HTML outputs.
- `db-preview/` contains preview-card selection, guarded dev-preview sizing, and namespaced write/reset helpers.

New data sources should go under `sources/<source-name>/`. New rating logic belongs in `domain/rating/`. New quality checks belong in `domain/evaluation/`. New report outputs belong in `reporting/`. New commands belong in `cli/` and should call `application/` rather than embedding business logic.

## Preset

Run the default report generation with:

```bash
pnpm db:rating-lab
```

Run the deterministic full loop with:

```bash
pnpm db:rating-lab:loop
```

Both commands default to `data/sources/fjelstul-worldcup/data-csv`, preset `pre-phase-1b-calibration`, `sample=iconic-plus-random`, `randomCount=300`, and `seed=42`. The loop ingests source CSVs, resolves ratings, writes reports, evaluates gates, generates the static HTML preview, and prints a dev DB preview estimate.

## Gates

Run gate evaluation against the latest summary:

```bash
pnpm db:rating-lab:gate
```

The zero-argument command reports status without failing the shell, which keeps local tuning loops ergonomic. Use `--fail-on-not-ready` in CI or release checks.

Hard failures include unresolved/invalid cards, benchmark failures, generated-only tournament top-three cards, unknown high generated ratings, award-floor misses, and structured hard anomalies.

Warnings include benchmark warnings, high 7a0 manual-reference deltas, high overall/stat delta p90, pairwise ordering warnings, and other review-oriented signals.

Generated-only ratings are capped before award floors when the source signal is weak: no appearance/goals/awards caps at 78, limited appearance signal caps at 84, and generated-only cards without strong individual signal cap at 88. Manual floors, award floors, and future high-confidence external ratings can still exceed those caps.

## Compare

Compare a current report against an accepted baseline:

```bash
pnpm db:rating-lab:compare -- --baseline data/import-reports/rating-lab/accepted-baseline.json --current data/import-reports/rating-lab/latest-summary.json
```

The comparison reports coverage, gate status, rating changes, tier changes, benchmark status changes, 7a0 manual-reference delta changes, new/resolved anomalies, and source/provenance changes. It is summary-based and does not require a database.

## Pairwise Checks

Pairwise checks catch ordering mistakes that range benchmarks can miss, such as Romario 1994 versus Bebeto 1994 or Yashin 1966 versus Bannikov 1966. Most are warnings because cross-era football comparisons are inherently noisy.

## Rating Provenance

Private CSV rows include debug fields such as `formulaVersion`, `selectedDistributionStrategy`, `primarySource`, `confidence`, `baseRating`, `rawEvidenceOverall`, `selectedOverall`, `seasonAbilityBaseline`, `worldCupPerformanceRating`, `manualAnchorAdjustment`, `capsApplied`, `evidenceSummary`, `comparisonSummary`, `finalOverall`, `estimatedOverallFromStats`, `overallStatDelta`, `reasons`, and `warnings`.

Some modifier fields are currently placeholders until the resolver exposes exact modifier values.

## Reports

Reports are written to `data/import-reports/rating-lab/` and include timestamped files plus `latest-summary.json`.

Review these first:

- `rating-lab-icons-*.csv`
- `rating-lab-seven-a-zero-manual-references-*.csv`
- `rating-lab-seven-a-zero-comparison-*.csv`
- `rating-lab-top-by-tournament-*.csv`
- `rating-lab-generated-only-outliers-*.csv`
- `rating-lab-award-winners-*.csv`
- `rating-lab-anomalies-*.csv`
- `rating-lab-source-availability-*.csv`
- `rating-lab-rating-distribution-buckets-*.csv`
- `rating-lab-rating-distribution-groups-*.csv`

`rating-lab-seven-a-zero-manual-references-*.csv` is the default 7a0 review artifact. It compares cards against curated manual reference values. `rating-lab-seven-a-zero-comparison-*.csv` is only for optional local JSON comparison files; those files are validated, not loaded by default, and invalid `player.f` values are surfaced as source warnings rather than silently treated as ratings.

## Static Preview

Generate a private static HTML preview from the latest summary:

```bash
pnpm db:rating-lab:preview
```

This writes:

```text
data/import-reports/rating-lab/rating-lab-preview.html
```

Use this Stage A preview for fast visual debugging before writing anything to a database. It includes gate status, source availability, elite distribution buckets, top cards by tournament, icons/heroes, generated-only outliers, anomalies, 7a0 manual-reference delta summary, random sample, goalkeepers, pre-1966 cards, and modern cards.

## Dev DB Preview

Stage B dev DB preview is intentionally guarded for Neon Free safety. Estimate-only is available:

```bash
pnpm db:rating-lab:write-dev-preview -- --report data/import-reports/rating-lab/latest-summary.json --max-cards 500 --dev-only --estimate-only
```

Actual writes are available for development only and use the ingested rating-lab summary, not the fictional seed set:

```bash
pnpm db:rating-lab:loop -- --source-dir data/sources/fjelstul-worldcup/data-csv --preset pre-phase-1b-calibration --seed 42 --write-dev-preview --dev-only --reset-rating-lab-preview
```

The writer:

1. Refuse production mode.
2. Refuse missing `DATABASE_URL`.
3. Require `--dev-only`.
4. Require `--reset-rating-lab-preview` for writes.
5. Keep default preview cards at 500 and hard cap at 1,000 unless explicitly overridden.
6. Estimate rows/storage before writing.
7. Delete only rows created by `source_imports.source_name = "rating_lab_preview"` or identities prefixed with `rating-lab-preview:`.
8. Reuse/create nations and World Cup editions, then insert source players, identities, public-safe aliases, cards, and generated stats.

If the estimated preview import exceeds conservative Neon Free limits, use Stage A HTML preview only. Full Fjelstul catalog import remains Phase 1B, not this preview command.

## External Source Adapters

The lab has a local-only source registry for Fjelstul, Transfermarkt, EA historical, ClubElo, FBref, StatsBomb, FiveThirtyEight, annual awards, manual anchors, and 7a0 manual references. Adapters do not download data. Missing optional local source directories produce source availability warnings.

Transfermarkt is profile/baseline-ready but report-only in this spike. Use:

```bash
pnpm db:rating-lab:profile-transfermarkt
pnpm db:rating-lab:profile-sources
```

Transfermarkt market value is converted into percentile baselines inside comparable peer groups; raw market value is never treated as a rating. Multi-season helpers report same-season, previous-season, two-seasons-back, three-seasons-back, weighted score, and trend direction.

7a0 manual references are comparison-only by default. They are not rating floors. If an iconic player needs protection, add an explicit manual anchor with its own reason.

## Dev Sample Eye Test

Full production writing remains out of scope. The safe current loop is:

1. Run `pnpm db:rating-lab:loop`.
2. Review gate status, CSVs, and `data/import-reports/rating-lab/rating-lab-preview.html`.
3. Tune rating logic, manual floors, pairwise checks, or source parsing.
4. Re-run the loop until hard failures are zero and warnings are explainable.
5. When you want the real app eye test, run the loop with `--write-dev-preview --dev-only --reset-rating-lab-preview`.
6. Start API/web and eye-test Collection filters by year, nation, tier, position, and rating.
7. Re-run the same dev-preview command to reset and replace only `rating_lab_preview` rows.

The future dev sample should balance icons, benchmark targets, 7a0 manual references, award winners, top tournament cards, generated-only outliers, random players, goalkeepers, pre-1966 players, and modern players for Collection UI inspection.

## Confidence Before Phase 1B

The team should be close to `READY_FOR_PHASE_1B` when:

1. 100% of sampled cards receive valid overall ratings and stats.
2. Award winners meet floors.
3. Benchmark failures are zero and warnings are explainable.
4. No generated-only player is tournament top three without strong reasons.
5. Overall/stat estimate p90 is within gate limits.
6. Local 7a0 manual-reference deltas are reasonable.
7. Pairwise ordering warnings are explainable.
8. Public API safety tests still pass.
9. Reports are deterministic with seed.
10. Reviewers agree top-by-tournament CSVs look plausible.

## Promote Later

Promote stable parsing, matching, rating generation, gate rules, and reporting logic into Phase 1B. Keep local source datasets, generated reports, comparison JSON, unlicensed research data, and spike-only tuning scaffolding out of main production paths.
