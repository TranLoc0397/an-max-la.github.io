-- Run once in Supabase SQL Editor to enable manually added guest members.
alter table public.members
  add column if not exists is_guest boolean not null default false;

create or replace function public.add_guest_member(p_trip_id uuid,p_name text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare guest_id uuid;
begin
  if auth.uid() is null or not public.is_trip_member(p_trip_id) then
    raise exception 'Only members of this trip can add a guest';
  end if;
  if nullif(trim(p_name),'') is null then
    raise exception 'Member name is required';
  end if;

  guest_id := gen_random_uuid();
  insert into public.members(trip_id,user_id,name,is_guest)
  values(p_trip_id,guest_id,left(trim(p_name),40),true);
  return guest_id;
end;
$$;

grant execute on function public.add_guest_member(uuid,text) to authenticated;
notify pgrst, 'reload schema';
