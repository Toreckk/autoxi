# API Design

Use REST for the first slice.

## Endpoints

### `GET /health`

Returns API status.

Example:

```json
{
  "status": "ok"
}
```

### `GET /cards`

Returns paginated public cards.

Supported query params:

- `search`
- `tier`
- `minRating`
- `maxRating`
- `position`
- `broadLine`
- `nation`
- `year`
- `host`
- `role`
- `stat`
- `statMin`
- `sort`
- `page`
- `pageSize`

Example:

```text
GET /cards?search=maestro&tier=STAR&nation=CRO&minRating=80&sort=rating_desc&page=1&pageSize=40
```

### `GET /cards/:id`

Returns one public card by ID.

### `GET /cards/meta/filters`

Returns available filter values:

- nations,
- years,
- hosts,
- positions,
- broad lines,
- tiers,
- roles,
- stat keys,
- sort options.

### Optional Dev Endpoint

`GET /dev/seed-status`

Only expose in development. It can help verify seed counts and data versions.

## Public Card DTO

```ts
type PublicCardDto = {
  id: string;
  publicName: string;
  shortName: string;
  rating: number;
  tier: CardTier;
  cost: number;
  position: VisiblePosition;
  broadLine: BroadLine;
  nation: {
    code: string;
    name: string;
    flag: string | null;
  };
  worldCup: {
    host: string;
    year: number;
  };
  role: CardRole;
  stats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
    goalkeeping: number;
  };
  cardMaterialKey: string;
  animationLevel: number;
};
```

## Sorting

Initial sort keys:

- `rating_desc`
- `rating_asc`
- `name_asc`
- `name_desc`
- `tier_desc`
- `tier_asc`
- `year_desc`
- `year_asc`
- `nationality_asc`

## API Safety

Public endpoints must not return:

- raw names,
- source import payloads,
- source IDs,
- alias risk score,
- approval metadata,
- private audit mapping.

