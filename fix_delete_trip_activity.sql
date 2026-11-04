-- Run this once in Supabase SQL Editor (after payment_history.sql).
-- Bug: deleting a trip cascades to expenses/contributions/debts/payments. Their audit trigger
-- then inserts a trip_activity row pointing at the trip that is being deleted, which violates
-- trip_activity_trip_id_fkey and aborts the whole delete ("Xóa chuyến đi" fails for any trip
-- that has records).
-- Fix: skip audit logging when the parent trip no longer exists. Row-level AFTER triggers see
-- all changes made by the outer command, so during a cascade the trip row is already gone.
create or replace function public.log_trip_activity()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare before_row jsonb; after_row jsonb; current_row jsonb; target_trip uuid;
begin
 before_row := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end;
 after_row := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end;
 current_row := coalesce(after_row,before_row);
 target_trip := (current_row->>'trip_id')::uuid;
 if not exists(select 1 from public.trips where id=target_trip) then
  return coalesce(NEW,OLD); -- trip is being deleted; its activity log is cascaded away too
 end if;
 insert into public.trip_activity(trip_id,source_table,action,record_id,actor_id,before_data,after_data)
 values(target_trip,TG_TABLE_NAME,TG_OP,(current_row->>'id')::uuid,auth.uid(),before_row,after_row);
 return coalesce(NEW,OLD);
end;
$$;
revoke all on function public.log_trip_activity() from public, anon, authenticated;
