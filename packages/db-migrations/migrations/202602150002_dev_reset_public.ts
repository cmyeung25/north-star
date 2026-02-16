import type { MigrationBuilder } from "node-pg-migrate";

const canRunDestructive = () => process.env.ALLOW_DESTRUCTIVE_MIGRATIONS === "true";

export async function up(pgm: MigrationBuilder): Promise<void> {
  if (!canRunDestructive()) {
    pgm.sql(`select 1;`);
    return;
  }

  pgm.sql(`drop table if exists public.scenarios cascade;`);
  pgm.sql(`drop table if exists public.cases cascade;`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  if (!canRunDestructive()) {
    pgm.sql(`select 1;`);
    return;
  }

  pgm.sql(`select 1;`);
}
