import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`create extension if not exists "pgcrypto";`);

  pgm.sql(`
    create or replace function public.set_updated_at()
    returns trigger
    language plpgsql
    as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$;
  `);

  pgm.sql(`
    create table if not exists public.cases (
      id uuid primary key default gen_random_uuid(),
      owner_id uuid not null references auth.users(id) on delete cascade,
      title text not null,
      description text,
      currency text not null default 'HKD',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  pgm.sql(`create index if not exists idx_cases_owner_id on public.cases(owner_id);`);
  pgm.sql(`create index if not exists idx_cases_updated_at on public.cases(updated_at);`);
  pgm.sql(`drop trigger if exists trg_cases_updated_at on public.cases;`);
  pgm.sql(`
    create trigger trg_cases_updated_at
    before update on public.cases
    for each row execute function public.set_updated_at();
  `);

  pgm.sql(`
    create table if not exists public.scenarios (
      id uuid primary key default gen_random_uuid(),
      case_id uuid not null references public.cases(id) on delete cascade,
      owner_id uuid not null references auth.users(id) on delete cascade,
      title text not null,
      state jsonb not null default '{}'::jsonb,
      revision int not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  pgm.sql(`create index if not exists idx_scenarios_owner_id on public.scenarios(owner_id);`);
  pgm.sql(`create index if not exists idx_scenarios_case_id on public.scenarios(case_id);`);
  pgm.sql(`create index if not exists idx_scenarios_updated_at on public.scenarios(updated_at);`);
  pgm.sql(`drop trigger if exists trg_scenarios_updated_at on public.scenarios;`);
  pgm.sql(`
    create trigger trg_scenarios_updated_at
    before update on public.scenarios
    for each row execute function public.set_updated_at();
  `);

  pgm.sql(`alter table public.cases enable row level security;`);
  pgm.sql(`alter table public.scenarios enable row level security;`);

  pgm.sql(`drop policy if exists cases_select_own on public.cases;`);
  pgm.sql(`
    create policy cases_select_own
    on public.cases for select
    to authenticated
    using ((select auth.uid()) = owner_id);
  `);

  pgm.sql(`drop policy if exists cases_insert_own on public.cases;`);
  pgm.sql(`
    create policy cases_insert_own
    on public.cases for insert
    to authenticated
    with check ((select auth.uid()) = owner_id);
  `);

  pgm.sql(`drop policy if exists cases_update_own on public.cases;`);
  pgm.sql(`
    create policy cases_update_own
    on public.cases for update
    to authenticated
    using ((select auth.uid()) = owner_id)
    with check ((select auth.uid()) = owner_id);
  `);

  pgm.sql(`drop policy if exists cases_delete_own on public.cases;`);
  pgm.sql(`
    create policy cases_delete_own
    on public.cases for delete
    to authenticated
    using ((select auth.uid()) = owner_id);
  `);

  pgm.sql(`drop policy if exists scenarios_select_own on public.scenarios;`);
  pgm.sql(`
    create policy scenarios_select_own
    on public.scenarios for select
    to authenticated
    using ((select auth.uid()) = owner_id);
  `);

  pgm.sql(`drop policy if exists scenarios_insert_own on public.scenarios;`);
  pgm.sql(`
    create policy scenarios_insert_own
    on public.scenarios for insert
    to authenticated
    with check ((select auth.uid()) = owner_id);
  `);

  pgm.sql(`drop policy if exists scenarios_update_own on public.scenarios;`);
  pgm.sql(`
    create policy scenarios_update_own
    on public.scenarios for update
    to authenticated
    using ((select auth.uid()) = owner_id)
    with check ((select auth.uid()) = owner_id);
  `);

  pgm.sql(`drop policy if exists scenarios_delete_own on public.scenarios;`);
  pgm.sql(`
    create policy scenarios_delete_own
    on public.scenarios for delete
    to authenticated
    using ((select auth.uid()) = owner_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`drop table if exists public.scenarios cascade;`);
  pgm.sql(`drop table if exists public.cases cascade;`);
}
