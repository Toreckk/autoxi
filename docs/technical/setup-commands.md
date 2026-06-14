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

Create folders:

```powershell
New-Item -ItemType Directory -Force apps, packages, packages\db, packages\domain, packages\config
```

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
pnpm add @nestjs/config zod fp-ts -F @autoxi/api
pnpm add -D tsx -F @autoxi/api
```

DB:

```powershell
pnpm add drizzle-orm postgres zod fp-ts -F @autoxi/db
pnpm add -D drizzle-kit tsx -F @autoxi/db
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

## 5. Drizzle Setup

Set `DATABASE_URL` and `DATABASE_MIGRATION_URL` in `.env.local`, then:

```powershell
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:studio
```

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
    "db:generate": "pnpm -F @autoxi/db db:generate",
    "db:migrate": "pnpm -F @autoxi/db db:migrate",
    "db:seed": "pnpm -F @autoxi/db db:seed",
    "db:studio": "pnpm -F @autoxi/db db:studio"
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

Use the root `.env.example` as the single committed env template. Real values live only in ignored `.env.local`.
