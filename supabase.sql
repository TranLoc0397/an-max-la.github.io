  -- Run this whole script in Supabase SQL Editor.
  create extension if not exists pgcrypto;

  create table if not exists public.trips (
   id uuid primary key default gen_random_uuid(),
   invite_code uuid not null unique default gen_random_uuid(),
   name text not null,
   budget numeric default 0,
   initial_fund numeric not null default 0,
   created_by uuid not null,
   created_at timestamptz default now()
  );
  alter table public.trips add column if not exists initial_fund numeric not null default 0;
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

  -- Anyone holding the invitation code can join exactly that trip.
  create or replace function public.join_trip(p_invite_code uuid,p_name text)
  returns uuid language plpgsql security definer set search_path=public
  as $$
  declare tid uuid;
  begin
   select id into tid from public.trips where invite_code=p_invite_code;
   if tid is null then raise exception 'Invalid invitation link'; end if;
   insert into public.members(trip_id,user_id,name)
   values(tid,auth.uid(),left(trim(p_name),40))
   on conflict(trip_id,user_id) do update set name=excluded.name;
   return tid;
  end;
  $$;
  grant execute on function public.join_trip(uuid,text) to authenticated;

  -- A share link grants read-only access without creating a member or changing the split.
  create or replace function public.get_shared_trip(p_invite_code uuid)
  returns jsonb language plpgsql security definer set search_path=public
  as $$
  declare t public.trips%rowtype;
  begin
   select * into t from public.trips where invite_code=p_invite_code;
   if not found then raise exception 'Invalid invitation link'; end if;
   return jsonb_build_object(
    'trip',to_jsonb(t),
    'members',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.members m where m.trip_id=t.id),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(to_jsonb(e) order by e.spent_on desc) from public.expenses e where e.trip_id=t.id),'[]'::jsonb),
    'contributions',coalesce((select jsonb_agg(to_jsonb(c) order by c.paid_on desc) from public.contributions c where c.trip_id=t.id),'[]'::jsonb)
   );
  end;
  $$;
  revoke all on function public.get_shared_trip(uuid) from public;
  grant execute on function public.get_shared_trip(uuid) to authenticated;

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

  drop policy if exists "link access trips" on public.trips;
  drop policy if exists "link access members" on public.members;
  drop policy if exists "link access expenses" on public.expenses;
  drop policy if exists "link access contributions" on public.contributions;

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

  grant usage on schema public to authenticated;
  grant select,insert,update,delete on public.trips,public.members,public.expenses,public.contributions to authenticated;
  grant usage,select on all sequences in schema public to authenticated;
  alter publication supabase_realtime add table public.members;
  alter publication supabase_realtime add table public.expenses;
  alter publication supabase_realtime add table public.contributions;
