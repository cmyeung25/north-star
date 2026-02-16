# Database migrations

North Star uses TypeScript migrations (`node-pg-migrate`) as the **only source of truth** for Postgres/Supabase schema changes.

## Rules

- Never edit production schema manually in Supabase Studio.
- All schema/RLS/index updates must ship as migrations in `packages/db-migrations/migrations`.
- Every migration must include both `up` and `down`.

## Environment variables

Required:

- `DATABASE_URL`: server-side Postgres connection string.

Optional (dev/beta only):

- `ALLOW_DESTRUCTIVE_MIGRATIONS=true`: allows the guarded dev reset migration to drop `public.cases` and `public.scenarios`.

## Commands

Run from repo root:

- `pnpm db:migrate` - run pending migrations.
- `pnpm db:status` - print applied/pending migration status.
- `pnpm db:rollback` - rollback one migration.
- `pnpm db:create <name>` - create a timestamped migration file.

## CI recommendation (GitHub Actions)

Suggested check in CI:

1. Provision an ephemeral Postgres instance.
2. Set `DATABASE_URL` in CI secrets/environment.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm db:migrate`.
5. Run quality gates (`pnpm -w lint`, `pnpm -w typecheck`, `pnpm -w test`, `pnpm -w --filter web build`).

This catches migration drift early and ensures app + database schema stay aligned.
