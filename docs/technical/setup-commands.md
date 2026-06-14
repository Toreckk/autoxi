# Initial Setup Commands

These commands are the proposed starting sequence for the first implementation slice. Adjust package versions during implementation if current tool defaults have changed.

## 1. Initialize Workspace

```powershell
pnpm init
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create folders if Prisma is chosen:

```powershell
New-Item -ItemType Directory -Force apps, packages, prisma
```

If Drizzle is chosen after the ORM spike, use `db` instead of `prisma` for root schema/migration files.

## 2. Create Apps

Create the web app:

```powershell
pnpm create vite apps/web --template react-ts
```

Create the API app:

```powershell
pnpm dlx @nestjs/cli new apps/api --package-manager pnpm
```

If the Nest CLI creates its own git files or package setup, clean that up carefully during implementation so the repo remains one monorepo.

## 3. Create Shared Packages

```powershell
New-Item -ItemType Directory -Force packages/domain/src, packages/config
```

`packages/domain` should contain shared Zod schemas, DTO types, and pure card helpers.

## 4. Install Core Dependencies

Root/dev dependencies:

```powershell
pnpm add -D typescript prettier eslint
```

Shared domain:

```powershell
pnpm add zod fp-ts -F @autoxi/domain
```

API:

```powershell
pnpm add @nestjs/config @prisma/client zod fp-ts -F @autoxi/api
pnpm add -D prisma tsx -F @autoxi/api
```

Web:

```powershell
pnpm add @tanstack/react-query react-router-dom zod -F @autoxi/web
pnpm add -D tailwindcss postcss autoprefixer -F @autoxi/web
```

shadcn setup should be run after Tailwind is configured:

```powershell
pnpm dlx shadcn@latest init
```

## 5. ORM Setup

### Prisma Default

```powershell
pnpm prisma init
```

Set `DATABASE_URL` and `DIRECT_URL` in `.env`, then:

```powershell
pnpm prisma migrate dev --name init
pnpm prisma db seed
pnpm prisma studio
```

### Drizzle Alternative

If the ORM spike chooses Drizzle, install Drizzle packages and initialize a `drizzle.config.ts` instead:

```powershell
pnpm add drizzle-orm postgres -F @autoxi/api
pnpm add -D drizzle-kit -F @autoxi/api
```

Then create schema files under `db/` or `apps/api/src/db/` and use Drizzle Kit for migrations.

## 6. Development Scripts

Recommended root scripts:

```json
{
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "dev:api": "pnpm -F @autoxi/api dev",
    "dev:web": "pnpm -F @autoxi/web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "db:migrate": "pnpm prisma migrate dev",
    "db:seed": "pnpm prisma db seed",
    "db:studio": "pnpm prisma studio"
  }
}
```

## 7. First Verification

After the first implementation slice:

```powershell
pnpm dev:api
pnpm dev:web
```

Verify:

- `http://localhost:3000/health`
- `http://localhost:3000/cards`
- `http://localhost:3000/cards/meta/filters`
- `http://localhost:5173`
