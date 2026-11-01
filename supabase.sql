  -- Run this whole script in Supabase SQL Editor.
  create extension if not exists pgcrypto with schema extensions;

  create table if not exists public.trips (
   id uuid primary key default gen_random_uuid(),
   invite_code uuid not null unique default gen_random_uuid(),
   name text not null,
   budget numeric default 0,
   initial_fund numeric not null default 0,
   view_passcode_hash text,
   created_by uuid not null,
   created_at timestamptz default now()
  );
  alter table public.trips add column if not exists initial_fund numeric not null default 0;
  alter table public.trips add column if not exists view_passcode_hash text;
  alter table public.trips add column if not exists invite_code uuid;
  update public.trips set invite_code=gen_random_uuid() where invite_code is null;
  alter table public.trips alter column invite_code set default gen_random_uuid();
  create unique index if not exists trips_invite_code_unique on public.trips(invite_code);

  create table if not exists public.members (
   id uuid primary key default gen_random_uuid(),
   trip_id uuid not null references public.trips(id) on delete cascade,
   user_id uuid not null,
   name text not null,
 is_guest boolean not null default false,
   created_at timestamptz default now(),
   unique(trip_id,user_id)
  );
alter table public.members add column if not exists is_guest boolean not null default false;
  create table if not exists public.expenses (
   id uuid primary key default gen_random_uuid(),
   trip_id uuid not null references public.trips(id) on delete cascade,
   title text not null,
   amount numeric not null check(amount>0),
   payer_id uuid not null,
   payer_name text not null,
   category text default 'Other',
   spent_on date not null default current_date,
   note text not null default '',
   created_by uuid not null,
   created_at timestamptz default now()
  );
  alter table public.expenses add column if not exists note text not null default '';
  alter table public.expenses alter column payer_id drop not null;
  alter table public.expenses add column if not exists reimbursed boolean not null default false;
  alter table public.expenses add column if not exists reimbursed_at timestamptz;
  create table if not exists public.contributions (
   id uuid primary key default gen_random_uuid(),
   trip_id uuid not null references public.trips(id) on delete cascade,
   amount numeric not null check(amount>0),
   payer_id uuid not null,
   payer_name text not null,
   note text default '',
   paid_on date not null default current_date,
   created_by uuid not null,
   created_at timestamptz default now()
  );
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

  create or replace function public.is_trip_member(tid uuid)
  returns boolean language sql stable security definer set search_path=public
  as $$ select exists(select 1 from public.members where trip_id=tid and user_id=auth.uid()) $$;

  -- Trip owners can delete the trip and its dependent rows (cascade).
  create or replace function public.delete_trip(p_trip_id uuid)
  returns void language plpgsql security definer set search_path=public
  as $$
  begin
   if auth.uid() is null or not exists(
    select 1 from public.trips where id=p_trip_id and created_by=auth.uid()
   ) then raise exception 'Only the trip creator can delete this trip'; end if;
   delete from public.trips where id=p_trip_id;
  end;
  $$;
  revoke all on function public.delete_trip(uuid) from public;
  grant execute on function public.delete_trip(uuid) to authenticated;

  -- Joining or viewing by invitation requires the trip passcode unless the visitor is already a member or creator.
  drop function if exists public.join_trip(uuid,text);
  drop function if exists public.join_trip(uuid,text,text);
  create function public.join_trip(p_invite_code uuid,p_name text,p_passcode text default null)
  returns uuid language plpgsql security definer set search_path=public,extensions
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
   if nullif(trim(p_name),'') is null then raise exception 'A display name is required'; end if;
   insert into public.members(trip_id,user_id,name)
   values(t.id,auth.uid(),left(trim(p_name),40))
   on conflict(trip_id,user_id) do update set name=excluded.name;
   return t.id;
  end;
  $$;
  revoke all on function public.join_trip(uuid,text,text) from public;
  grant execute on function public.join_trip(uuid,text,text) to authenticated;

  create or replace function public.set_trip_view_passcode(p_trip_id uuid,p_passcode text)
  returns void language plpgsql security definer set search_path=public,extensions
  as $$
  begin
   if auth.uid() is null or not exists(select 1 from public.trips where id=p_trip_id and created_by=auth.uid()) then
    raise exception 'Only the trip creator can set the view passcode';
   end if;
   if p_passcode is null or length(trim(p_passcode))<8 or length(trim(p_passcode))>64 then
    raise exception 'Passcode must be between 8 and 64 characters';
   end if;
   update public.trips set view_passcode_hash=extensions.crypt(trim(p_passcode),extensions.gen_salt('bf',12)) where id=p_trip_id;
  end;
  $$;
  revoke all on function public.set_trip_view_passcode(uuid,text) from public;
  grant execute on function public.set_trip_view_passcode(uuid,text) to authenticated;

  drop function if exists public.get_shared_trip(uuid);
  drop function if exists public.get_shared_trip(uuid,text);
  create function public.get_shared_trip(p_invite_code uuid,p_passcode text default null)
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

create or replace function public.add_guest_member(p_trip_id uuid,p_name text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare guest_id uuid;
begin
 if auth.uid() is null or not public.is_trip_member(p_trip_id) then
  raise exception 'Only members of this trip can add a guest';
 end if;
 if nullif(trim(p_name),'') is null then raise exception 'Member name is required'; end if;
 guest_id := gen_random_uuid();
 insert into public.members(trip_id,user_id,name,is_guest)
 values(p_trip_id,guest_id,left(trim(p_name),40),true);
 return guest_id;
end;
$$;
grant execute on function public.add_guest_member(uuid,text) to authenticated;
notify pgrst, 'reload schema';

  alter table public.trips enable row level security;
  alter table public.members enable row level security;
  alter table public.expenses enable row level security;
  alter table public.contributions enable row level security;
  alter table public.member_debts enable row level security;

  drop policy if exists "link access trips" on public.trips;
  drop policy if exists "link access members" on public.members;
  drop policy if exists "link access expenses" on public.expenses;
  drop policy if exists "link access contributions" on public.contributions;
  drop policy if exists "members manage member debts" on public.member_debts;

  create policy "create own trips" on public.trips for insert to authenticated
   with check(created_by=auth.uid());
  create policy "members read trips" on public.trips for select to authenticated
   using(public.is_trip_member(id));
  create policy "members update trips" on public.trips for update to authenticated
   using(public.is_trip_member(id)) with check(public.is_trip_member(id));

  create policy "members read roster" on public.members for select to authenticated
   using(public.is_trip_member(trip_id));
  create policy "members update own profile" on public.members for update to authenticated
   using(user_id=auth.uid() and public.is_trip_member(trip_id))
   with check(user_id=auth.uid() and public.is_trip_member(trip_id));
  -- Membership creation is handled by the join_trip RPC.

  create policy "members manage expenses" on public.expenses for all to authenticated
   using(public.is_trip_member(trip_id)) with check(public.is_trip_member(trip_id));
  create policy "members manage contributions" on public.contributions for all to authenticated
   using(public.is_trip_member(trip_id)) with check(public.is_trip_member(trip_id));
  create policy "members manage member debts" on public.member_debts for all to authenticated
   using(public.is_trip_member(trip_id)) with check(public.is_trip_member(trip_id));

  grant usage on schema public to authenticated;
  grant select,insert,update,delete on public.trips,public.members,public.expenses,public.contributions,public.member_debts to authenticated;
  grant usage,select on all sequences in schema public to authenticated;
  alter publication supabase_realtime add table public.members;
  alter publication supabase_realtime add table public.expenses;
  alter publication supabase_realtime add table public.contributions;
  alter publication supabase_realtime add table public.member_debts;
