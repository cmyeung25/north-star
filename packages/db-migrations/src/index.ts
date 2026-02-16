import dotenv from "dotenv";

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { Client } from "pg";
import { runner } from "node-pg-migrate";

const command = process.argv[2] ?? "up";
const arg = process.argv[3];

const packageRoot = path.resolve(__dirname, "..");
const migrationsDir = path.resolve(packageRoot, "migrations");

// ✅ 強制讀 repo root .env（monorepo 可靠）
dotenv.config({
  path: path.resolve(__dirname, "../../../apps/web/.env"),
});

// 如果你想同時支援 .env.local（可選）
dotenv.config({
  path: path.resolve(__dirname, "../../../apps/web/.env.local"),
  override: false,
});

const getDatabaseUrl = () => {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("Missing DATABASE_URL. Set it before running migrations.");
  }
  return value;
};

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

const nowTimestamp = () => {
  const date = new Date();
  const pad = (input: number) => String(input).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
};

const createMigration = () => {
  if (!arg) {
    throw new Error("Usage: pnpm db:create <migration_name>");
  }

  const filename = `${nowTimestamp()}_${toSlug(arg)}.ts`;
  const targetPath = path.join(migrationsDir, filename);
  const template = `import type { MigrationBuilder } from "node-pg-migrate";\n\nexport async function up(pgm: MigrationBuilder): Promise<void> {\n  // TODO: add migration SQL\n}\n\nexport async function down(pgm: MigrationBuilder): Promise<void> {\n  // TODO: rollback SQL\n}\n`;

  fs.writeFileSync(targetPath, template, "utf8");
  console.log(`Created migration: ${path.relative(process.cwd(), targetPath)}`);
};

const printStatus = async () => {
  const client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();

  try {
    await client.query(`
      create table if not exists public.pgmigrations (
        id serial primary key,
        name varchar(255) not null,
        run_on timestamp not null
      );
    `);

    const { rows } = await client.query<{ name: string; run_on: string }>(
      "select name, run_on::text from public.pgmigrations order by id asc"
    );

    const applied = new Set(rows.map((row) => row.name));
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => /\.ts$/.test(file))
      .sort();

    console.log("Migration status:\n");
    for (const file of files) {
      const mark = applied.has(file) ? "[applied]" : "[pending]";
      console.log(`${mark} ${file}`);
    }

    if (rows.length === 0) {
      console.log("\nNo applied migrations yet.");
    }
  } finally {
    await client.end();
  }
};

const migrate = async (direction: "up" | "down") => {
  const count = direction === "down" ? Number(arg ?? "1") : undefined;

  await runner({
    databaseUrl: getDatabaseUrl(),
    dir: migrationsDir,
    direction,
    count,
    migrationsTable: "pgmigrations",
    migrationsSchema: "public",
    createMigrationsSchema: true,
    checkOrder: true,
    verbose: true,
    decamelize: false,
    ignorePattern: "(^|/)\\..*",
  });
};

const main = async () => {
  switch (command) {
    case "create":
      createMigration();
      break;
    case "status":
      await printStatus();
      break;
    case "up":
      await migrate("up");
      break;
    case "down":
      await migrate("down");
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
