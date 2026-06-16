# Rating Lab Source Layout

Local source data lives under `data/sources/` and is intentionally ignored by git.

Expected default paths:

- `fjelstul-worldcup/data-csv/`: required Fjelstul World Cup CSV source.
- `transfermarkt/`: optional local Transfermarkt exports for profiling, matching, percentile baselines, and high-confidence RAW_EVIDENCE blending.
- `ea-fc-ratings/`: optional future EA/FC historical adapter input.
- `club-elo/`: optional future club-strength source.
- `fbref/`: optional future player-stat source.
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

Transfermarkt high-confidence matches can affect ratings. MEDIUM/LOW matches remain report-only by default. EA, ClubElo, StatsBomb, FiveThirtyEight, FBref, and annual awards remain available/profiled/skeleton sources until separately implemented.
