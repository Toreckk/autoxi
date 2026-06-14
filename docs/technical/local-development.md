# Local Development

The first setup should work on Windows without Docker or locally installed PostgreSQL.

## Preferred Setup: Neon PostgreSQL

1. Create a Neon project.
2. Copy the connection string.
3. Create local `.env` files.
4. Install dependencies with pnpm.
5. Run Drizzle migration.
6. Seed the database.
7. Start API.
8. Start client.
9. Verify endpoints and Collection page.

Free-tier limits can change, so check Neon limits before relying on them for long-term development or testing.

## Expected Environment Variables

API:

```env
NODE_ENV="development"
API_PORT="3000"
DATABASE_URL="postgresql://..."
DATABASE_MIGRATION_URL="postgresql://..."
```

Web:

```env
VITE_API_BASE_URL="http://localhost:3000"
```

## Verification

Verify:

- `GET http://localhost:3000/health`
- `GET http://localhost:3000/cards`
- `GET http://localhost:3000/cards/meta/filters`
- `http://localhost:5173` loads the web app
- Collection page displays seeded cards

## Optional Local PostgreSQL

If hosted Postgres becomes annoying, install PostgreSQL locally with the official Windows installer. Use pgAdmin, Drizzle Studio, or another PostgreSQL client for inspection. This is optional and should not block the first slice.
