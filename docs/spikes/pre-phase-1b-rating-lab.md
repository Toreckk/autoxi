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

Manual curation provides protective floors, not exact ratings. Optional EA-style, retro, 538, StatsBomb, and 7a0 inputs are local research/calibration signals until licensing and permission questions are resolved.

## Preset

Run the deterministic calibration preset with:

```bash
pnpm db:rating-lab -- --source-dir data/sources/fjelstul-worldcup/data-csv --preset pre-phase-1b-calibration --seed 42
```

The preset currently maps to `sample=iconic-plus-random`, `randomCount=300`, and `seed=42`. TODOs remain for richer multi-seed grouped exports such as a dedicated goalkeeper sample, pre-1966 sample, and modern sample.

## Gates

Run gate evaluation against the latest summary:

```bash
pnpm db:rating-lab:gate -- --report data/import-reports/rating-lab/latest-summary.json
```

Use `--no-fail` during tuning if a non-ready status should not exit with code 1.

Hard failures include unresolved/invalid cards, benchmark failures, generated-only tournament top-three cards, unknown high generated ratings, award-floor misses, and structured hard anomalies.

Warnings include benchmark warnings, high 7a0 manual-reference deltas, high overall/stat delta p90, pairwise ordering warnings, and other review-oriented signals.

## Compare

Compare a current report against an accepted baseline:

```bash
pnpm db:rating-lab:compare -- --baseline data/import-reports/rating-lab/accepted-baseline.json --current data/import-reports/rating-lab/latest-summary.json
```

The comparison reports coverage, gate status, rating changes, tier changes, benchmark status changes, 7a0 manual-reference delta changes, new/resolved anomalies, and source/provenance changes. It is summary-based and does not require a database.

## Pairwise Checks

Pairwise checks catch ordering mistakes that range benchmarks can miss, such as Romario 1994 versus Bebeto 1994 or Yashin 1966 versus Bannikov 1966. Most are warnings because cross-era football comparisons are inherently noisy.

## Rating Provenance

Private CSV rows include debug fields such as `primarySource`, `confidence`, `baseRating`, `manualFloorApplied`, `awardFloorApplied`, `externalReferenceDelta`, `finalOverall`, `estimatedOverallFromStats`, `overallStatDelta`, `reasons`, and `warnings`.

Some modifier fields are currently placeholders until the resolver exposes exact modifier values.

## Reports

Reports are written to `data/import-reports/rating-lab/` and include timestamped files plus `latest-summary.json`.

Review these first:

- `rating-lab-icons-*.csv`
- `rating-lab-seven-a-zero-comparison-*.csv`
- `rating-lab-top-by-tournament-*.csv`
- `rating-lab-generated-only-outliers-*.csv`
- `rating-lab-award-winners-*.csv`
- `rating-lab-anomalies-*.csv`

## Dev Sample Eye Test

Full production writing remains out of scope. The intended later command is:

```bash
pnpm db:rating-lab:export-dev-sample -- --report data/import-reports/rating-lab/latest-summary.json --limit 500
```

That dev sample should balance icons, benchmark targets, 7a0 manual references, award winners, top tournament cards, generated-only outliers, random players, goalkeepers, pre-1966 players, and modern players for Collection UI inspection.

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
