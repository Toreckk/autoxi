# Pre-Phase-1B Rating Lab

This is a temporary, file-based spike for World Cup card rating calibration. It does not write to the production catalog and should not be treated as the final Phase 1B importer.

## Source Priority

1. `MANUAL_CURATED`
2. `EA_HISTORICAL`
3. `RETRO_REFERENCE`
4. `FIVETHIRTYEIGHT_WORLD_CUP`
5. `STATSBOMB_WORLD_CUP`
6. `SEVEN_A_ZERO_COMPARISON`
7. `FJELSTUL_GENERATED`

Manual curation provides protective rating floors for known icon cards. EA-style local files can provide ratings and stats only when high confidence and locally supplied. 7a0 data is comparison-only by default.

## Run

```bash
pnpm db:rating-lab -- --source-dir data/sources/fjelstul-worldcup/data-csv --sample iconic-plus-random --random-count 300 --seed 42
```

Optional local 7a0 comparison:

```bash
pnpm db:rating-lab -- --source-dir data/sources/fjelstul-worldcup/data-csv --seven-a-zero-dir data/sources/seven-a-zero/squads --sample iconic-plus-random --random-count 300 --seed 42
```

Reports are private dev artifacts written to `data/import-reports/rating-lab/`.
