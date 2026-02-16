# @north-star/db-migrations

TypeScript migrations for North Star's Supabase/Postgres schema using `node-pg-migrate`.

## Commands

From repo root:

- `pnpm db:migrate` - run pending migrations
- `pnpm db:status` - show applied/pending status
- `pnpm db:rollback` - rollback one migration
- `pnpm db:create <name>` - create a timestamped migration file

## Required environment

- `DATABASE_URL` must point to the target Postgres database.

Optional:

- `ALLOW_DESTRUCTIVE_MIGRATIONS=true` to allow guarded destructive reset migrations.
