-- Run this once in Supabase SQL Editor to enable deleting trips created by you.
-- Deleting a trip cascades to its members, expenses and contributions.
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
