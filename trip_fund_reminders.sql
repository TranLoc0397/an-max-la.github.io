-- Fund commitments are REMINDERS, not expenses or fund transactions.
-- To prevent double counting, the amount paid here is informational only.
create table if not exists public.trip_fund_reminders (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 100),
 total_amount numeric(16,0) not null check(total_amount > 0),
 paid_amount numeric(16,0) not null default 0 check(paid_amount >= 0 and paid_amount <= total_amount),
 due_on date,
 note text not null default '' check(length(note) <= 250),
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists trip_fund_reminders_trip_due
 on public.trip_fund_reminders(trip_id,due_on,created_at);
alter table public.trip_fund_reminders enable row level security;
drop policy if exists "trip fund reminders read" on public.trip_fund_reminders;
create policy "trip fund reminders read" on public.trip_fund_reminders
 for select to authenticated using (public.is_trip_member(trip_id) or exists(
   select 1 from public.trips t where t.id=trip_id and t.created_by=(select auth.uid())
 ));
drop policy if exists "trip fund reminders insert" on public.trip_fund_reminders;
create policy "trip fund reminders insert" on public.trip_fund_reminders
 for insert to authenticated with check (
   created_by=(select auth.uid()) and public.can_edit_trip(trip_id)
 );
drop policy if exists "trip fund reminders update" on public.trip_fund_reminders;
create policy "trip fund reminders update" on public.trip_fund_reminders
 for update to authenticated using(public.can_edit_trip(trip_id))
 with check(public.can_edit_trip(trip_id));
drop policy if exists "trip fund reminders delete" on public.trip_fund_reminders;
create policy "trip fund reminders delete" on public.trip_fund_reminders
 for delete to authenticated using(public.can_edit_trip(trip_id));
revoke all on public.trip_fund_reminders from public,anon,authenticated;
grant select,insert,update,delete on public.trip_fund_reminders to authenticated;
-- No automatic inserts. The Host/editor chooses the destination trip.
