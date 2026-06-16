# Rating Lab Source Layout

Local source data lives under `data/sources/` and is intentionally ignored by git.

Expected default paths:

- `fjelstul-worldcup/data-csv/`: required Fjelstul World Cup CSV source.
- `transfermarkt/`: optional local Transfermarkt exports for profiling, matching, and future percentile baselines.
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
