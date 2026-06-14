# Flag Assets

Phase 1 player cards need small nationality flags in the top-right corner. Use local frontend assets, not remote URLs per card.

## Decision

- Do not call a third-party flag CDN from every card.
- Do not store external flag URLs in seeded card DTOs.
- Store SVG flag assets locally in `apps/web/public/flags`.
- For Phase 1, include only flags needed by curated seed data.
- Add more flags later as ingestion expands.
- Use a permissively licensed open-source flag package as the source, preferably [`flag-icons` by lipis](https://github.com/lipis/flag-icons).
- Preserve the chosen package's license notice in the repo.
- Do not use Twemoji flags for Phase 1 because attribution/compliance is more work.
- Do not use football federation logos, FIFA logos, World Cup logos, club crests, or official tournament logos.

## Frontend Structure

Recommended Phase 1 asset structure:

```text
apps/web/public/flags/
  ar.svg
  br.svg
  de.svg
  fr.svg
  hr.svg
  it.svg
  nl.svg
  pt.svg
  es.svg
  eng.svg
  unknown.svg
```

Use ISO-style lowercase flag codes where possible.

Some football nations do not map cleanly to ISO sovereign-country codes. The project should support football-specific `flagCode` values where needed:

- `eng`
- `sct`
- `wal`
- `nir`

For Phase 1, do not overbuild this. Treat `flagCode` as the frontend asset key, not necessarily a strict ISO2 code.

## API Contract

The API returns `flagCode`. The frontend resolves it locally:

```text
/flags/{flagCode}.svg
```

If the asset is missing, the frontend falls back to:

```text
/flags/unknown.svg
```

Public DTO shape:

```ts
nation: {
  id: string;
  code: string;
  name: string;
  flagCode: string;
  flagUrl?: string;
}
```

`flagUrl` is optional and should be frontend-derived/local if used. It must not be a remote per-card URL in Phase 1.

## Database Recommendation

`nations` should include:

- `id`
- `iso2Code nullable`
- `iso3Code nullable`
- `fifaCode nullable`
- `displayName`
- `flagCode`
- `flagAssetPath optional`

`flagAssetPath` is optional because the frontend can derive `/flags/{flagCode}.svg`.
