-- Protect invitation link viewing and joining with a per-trip passcode.
create extension if not exists pgcrypto with schema extensions;
alter table public.trips add column if not exists view_passcode_hash text;

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
  'contributions',coalesce((select jsonb_agg(to_jsonb(c) order by c.paid_on desc) from public.contributions c where c.trip_id=t.id),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.get_shared_trip(uuid,text) from public;
grant execute on function public.get_shared_trip(uuid,text) to authenticated;
notify pgrst, 'reload schema';
