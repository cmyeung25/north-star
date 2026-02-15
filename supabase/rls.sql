-- Server persistence v1 RLS policies for case/scenario ownership.

alter table if exists public.cases enable row level security;
alter table if exists public.scenarios enable row level security;

create policy if not exists "cases_owner_select"
on public.cases
for select
using (auth.uid() = owner_id);

create policy if not exists "cases_owner_insert"
on public.cases
for insert
with check (auth.uid() = owner_id);

create policy if not exists "cases_owner_update"
on public.cases
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy if not exists "cases_owner_delete"
on public.cases
for delete
using (auth.uid() = owner_id);

create policy if not exists "scenarios_owner_select"
on public.scenarios
for select
using (auth.uid() = owner_id);

create policy if not exists "scenarios_owner_insert"
on public.scenarios
for insert
with check (auth.uid() = owner_id);

create policy if not exists "scenarios_owner_update"
on public.scenarios
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy if not exists "scenarios_owner_delete"
on public.scenarios
for delete
using (auth.uid() = owner_id);
