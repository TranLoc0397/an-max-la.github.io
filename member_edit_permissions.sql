-- Run once in Supabase SQL Editor to enable owner-managed editor access.
-- Existing joined members keep their current editing ability. New joiners default to view-only.

alter table public.members add column if not exists can_edit boolean not null default true;
alter table public.members alter column can_edit set default false;

create or replace function public.can_edit_trip(tid uuid)
returns boolean language sql stable security definer set search_path=public
as $$
 select exists(select 1 from public.trips where id=tid and created_by=auth.uid())
     or exists(select 1 from public.members where trip_id=tid and user_id=auth.uid() and can_edit)
$$;
revoke all on function public.can_edit_trip(uuid) from public;
grant execute on function public.can_edit_trip(uuid) to authenticated;

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
 if t.created_by<>auth.uid() and not exists(select 1 from public.members where trip_id=t.id and user_id=auth.uid()) then
  if t.view_passcode_hash is null then raise exception 'The trip creator has not set a passcode yet'; end if;
  if nullif(trim(p_passcode),'') is null then raise exception 'A passcode is required'; end if;
  if extensions.crypt(p_passcode,t.view_passcode_hash)<>t.view_passcode_hash then raise exception 'Incorrect passcode'; end if;
 end if;
 if nullif(trim(p_name),'') is null then raise exception 'A display name is required'; end if;
 insert into public.members(trip_id,user_id,name,can_edit)
 values(t.id,auth.uid(),left(trim(p_name),40),t.created_by=auth.uid())
 on conflict(trip_id,user_id) do update set name=excluded.name;
 return t.id;
end;
$$;
revoke all on function public.join_trip(uuid,text,text) from public;
grant execute on function public.join_trip(uuid,text,text) to authenticated;

create or replace function public.set_trip_member_edit_access(p_trip_id uuid,p_member_user_id uuid,p_can_edit boolean)
returns void language plpgsql security definer set search_path=public
as $$
declare owner_id uuid;
begin
 select created_by into owner_id from public.trips where id=p_trip_id;
 if auth.uid() is null or owner_id is null or owner_id<>auth.uid() then
  raise exception 'Only the trip creator can change edit access';
 end if;
 update public.members set can_edit=p_can_edit
  where trip_id=p_trip_id and user_id=p_member_user_id and user_id<>owner_id and not is_guest;
 if not found then raise exception 'Joined member not found'; end if;
end;
$$;
revoke all on function public.set_trip_member_edit_access(uuid,uuid,boolean) from public;
grant execute on function public.set_trip_member_edit_access(uuid,uuid,boolean) to authenticated;

create or replace function public.add_guest_member(p_trip_id uuid,p_name text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare guest_id uuid;
begin
 if auth.uid() is null or not public.can_edit_trip(p_trip_id) then
  raise exception 'Only trip editors can add a guest';
 end if;
 if nullif(trim(p_name),'') is null then raise exception 'Member name is required'; end if;
 guest_id := gen_random_uuid();
 insert into public.members(trip_id,user_id,name,is_guest)
 values(p_trip_id,guest_id,left(trim(p_name),40),true);
 return guest_id;
end;
$$;
revoke all on function public.add_guest_member(uuid,text) from public;
grant execute on function public.add_guest_member(uuid,text) to authenticated;

drop policy if exists "members update trips" on public.trips;
drop policy if exists "link access trips" on public.trips;
create policy "members update trips" on public.trips for update to authenticated
 using(public.can_edit_trip(id)) with check(public.can_edit_trip(id));

drop policy if exists "link access members" on public.members;
drop policy if exists "members manage expenses" on public.expenses;
drop policy if exists "members manage contributions" on public.contributions;
drop policy if exists "members manage member debts" on public.member_debts;
drop policy if exists "link access expenses" on public.expenses;
drop policy if exists "link access contributions" on public.contributions;
drop policy if exists "editors manage expenses" on public.expenses;
drop policy if exists "editors manage contributions" on public.contributions;
drop policy if exists "editors manage member debts" on public.member_debts;
create policy "editors manage expenses" on public.expenses for all to authenticated
 using(public.can_edit_trip(trip_id)) with check(public.can_edit_trip(trip_id));
create policy "editors manage contributions" on public.contributions for all to authenticated
 using(public.can_edit_trip(trip_id)) with check(public.can_edit_trip(trip_id));
create policy "editors manage member debts" on public.member_debts for all to authenticated
 using(public.can_edit_trip(trip_id)) with check(public.can_edit_trip(trip_id));

-- Prevent direct edits to role or trip ownership fields. RPCs above make the approved changes.
revoke insert,update,delete on public.members from authenticated;
grant select on public.members to authenticated;
grant update(name) on public.members to authenticated;
revoke update,delete on public.trips from authenticated;
grant select,insert on public.trips to authenticated;
grant update(initial_fund) on public.trips to authenticated;
grant select,insert,update,delete on public.expenses,public.contributions,public.member_debts to authenticated;

notify pgrst, 'reload schema';
