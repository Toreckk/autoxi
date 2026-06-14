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
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

Web:

```env
VITE_API_BASE_URL="http://localhost:3000"
```

If the frontend is opened at `127.0.0.1:5173` but the API only allows `localhost:5173`, browser CORS checks will fail. Include both `localhost` and `127.0.0.1` Vite origins in `CORS_ORIGINS` during local development. In non-production mode, the API also accepts loopback Vite fallback ports such as `5174` and `5175`, because Vite will pick the next free port when `5173` is busy.

## Verification

Verify:

- `GET http://localhost:3000/health`
- `GET http://localhost:3000/cards`
- `GET http://localhost:3000/cards/meta/filters`
- `http://localhost:5173` loads the web app
- `http://127.0.0.1:5173` loads the web app
- Collection page displays seeded cards

## Optional Local PostgreSQL

If hosted Postgres becomes annoying, install PostgreSQL locally with the official Windows installer. Use pgAdmin, Drizzle Studio, or another PostgreSQL client for inspection. This is optional and should not block the first slice.
