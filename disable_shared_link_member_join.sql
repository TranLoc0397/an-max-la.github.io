-- Prevent creating duplicate trip members from a shared invitation link.
-- Existing Host trip creation still works, and existing joined members can reopen.
-- Does not modify or delete any existing data.
create or replace function public.join_trip(
 p_invite_code uuid,
 p_name text,
 p_passcode text default null
) returns uuid language plpgsql security definer
set search_path=public,pg_temp as $$
declare tid uuid; owner_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select id,created_by into tid,owner_id from public.trips
  where invite_code=p_invite_code;
 if tid is null then raise exception 'Invalid invitation link'; end if;
 if exists(select 1 from public.members
   where trip_id=tid and user_id=auth.uid()) then
  return tid;
 end if;
 if owner_id<>auth.uid() then
  raise exception 'Joining by shared link is disabled. Ask the Host to link you to an existing member';
 end if;
 if nullif(trim(coalesce(p_name,'')),'') is null then
  raise exception 'A display name is required';
 end if;
 insert into public.members(trip_id,user_id,name,can_edit)
 values(tid,auth.uid(),left(trim(p_name),40),true)
 on conflict(trip_id,user_id) do nothing;
 return tid;
end;
$$;
revoke all on function public.join_trip(uuid,text,text) from public,anon,authenticated;
grant execute on function public.join_trip(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
