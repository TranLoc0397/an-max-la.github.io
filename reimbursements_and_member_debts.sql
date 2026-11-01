-- Track cash actually paid from the common fund separately from personal advances.
alter table public.expenses add column if not exists reimbursed boolean not null default false;
alter table public.expenses add column if not exists reimbursed_at timestamptz;

-- Member-to-member debts are separate from shared trip expenses and fund reimbursements.
create table if not exists public.member_debts (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id) on delete cascade,
 debtor_id uuid not null,
 creditor_id uuid not null,
 amount numeric not null check(amount>0),
 note text not null default '',
 incurred_on date not null default current_date,
 is_settled boolean not null default false,
 settled_at timestamptz,
 created_by uuid not null,
 created_at timestamptz default now(),
 check(debtor_id<>creditor_id),
 foreign key(trip_id,debtor_id) references public.members(trip_id,user_id) on delete cascade,
 foreign key(trip_id,creditor_id) references public.members(trip_id,user_id) on delete cascade
);
alter table public.member_debts enable row level security;
drop policy if exists "members manage member debts" on public.member_debts;
create policy "members manage member debts" on public.member_debts for all to authenticated
 using(public.is_trip_member(trip_id)) with check(public.is_trip_member(trip_id));
grant select,insert,update,delete on public.member_debts to authenticated;
do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='member_debts') then
  alter publication supabase_realtime add table public.member_debts;
 end if;
end $$;

-- Return debts only through the already passcode-guarded shared-trip RPC.
create or replace function public.get_shared_trip(p_invite_code uuid,p_passcode text default null)
returns jsonb language plpgsql security definer set search_path=public,extensions
as $$
declare t public.trips%rowtype;
begin
 select * into t from public.trips where invite_code=p_invite_code;
 if t.id is null then raise exception 'Invalid invitation link'; end if;
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if t.created_by<>auth.uid() and not public.is_trip_member(t.id) then
  if t.view_passcode_hash is null then raise exception 'The trip creator has not set a passcode yet'; end if;
  if nullif(trim(p_passcode),'') is null then raise exception 'A passcode is required'; end if;
  if extensions.crypt(p_passcode,t.view_passcode_hash)<>t.view_passcode_hash then raise exception 'Incorrect passcode'; end if;
 end if;
 return jsonb_build_object(
  'trip',(to_jsonb(t)-'view_passcode_hash')||jsonb_build_object('view_passcode_set',t.view_passcode_hash is not null),
  'members',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.members m where m.trip_id=t.id),'[]'::jsonb),
  'expenses',coalesce((select jsonb_agg(to_jsonb(e) order by e.spent_on desc) from public.expenses e where e.trip_id=t.id),'[]'::jsonb),
  'contributions',coalesce((select jsonb_agg(to_jsonb(c) order by c.paid_on desc) from public.contributions c where c.trip_id=t.id),'[]'::jsonb),
  'debts',coalesce((select jsonb_agg(to_jsonb(d) order by d.incurred_on desc) from public.member_debts d where d.trip_id=t.id),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.get_shared_trip(uuid,text) from public;
grant execute on function public.get_shared_trip(uuid,text) to authenticated;
notify pgrst, 'reload schema';
