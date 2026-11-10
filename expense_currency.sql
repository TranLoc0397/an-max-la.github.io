-- Multi-currency expenses. Run once in Supabase SQL Editor (after payment_history.sql).
-- The ledger stays in VND: expenses.amount is still the VND value every balance uses.
-- A foreign-currency expense also keeps what was actually paid and the rate used.
alter table public.expenses add column if not exists currency text not null default 'VND';
alter table public.expenses add column if not exists original_amount numeric(18,4);
alter table public.expenses add column if not exists fx_rate numeric(18,6);

alter table public.expenses drop constraint if exists expenses_currency_shape;
alter table public.expenses add constraint expenses_currency_shape check (
  currency ~ '^[A-Z]{3}$'
  and (
    (currency='VND' and original_amount is null and fx_rate is null)
    or (
      currency<>'VND' and original_amount>0 and fx_rate>0
      -- amount is the rounded conversion; allow 1 ₫ for client-side rounding.
      and abs(amount-round(original_amount*fx_rate))<=1
    )
  )
);

-- Restoring a deleted expense keeps its currency details (all other behaviour unchanged).
create or replace function public.restore_trip_record(p_trip_id uuid,p_activity_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare event public.trip_activity%rowtype; d jsonb; restored_id uuid;
begin
 if auth.uid() is null or not public.can_edit_trip(p_trip_id) then
  raise exception 'Editing permission required';
 end if;
 select * into event from public.trip_activity
 where id=p_activity_id and trip_id=p_trip_id and action='DELETE'
   and source_table in ('expenses','contributions');
 if not found then raise exception 'Restorable record not found'; end if;
 d:=event.before_data;restored_id:=event.record_id;
 if event.source_table='expenses' and exists(
   select 1 from public.trip_activity h
   where h.trip_id=p_trip_id and h.source_table='trip_payments' and h.action='DELETE'
     and h.before_data->>'expense_id'=restored_id::text
     and h.recorded_at between event.recorded_at-interval '10 seconds' and event.recorded_at+interval '10 seconds'
 ) then
  raise exception 'This deleted expense has payment history; restore payments alongside the expense';
 end if;
 if event.source_table='expenses' then
  if exists(select 1 from public.expenses where id=restored_id) then raise exception 'Expense already restored'; end if;
  if d->>'payer_id' is not null and not exists(select 1 from public.members where trip_id=p_trip_id and user_id=(d->>'payer_id')::uuid)
   then raise exception 'Cannot restore: original payer is no longer in this trip'; end if;
  insert into public.expenses(id,trip_id,title,amount,payer_id,payer_name,category,spent_on,
                              note,created_by,created_at,reimbursed,reimbursed_at,
                              currency,original_amount,fx_rate)
  values(restored_id,p_trip_id,d->>'title',(d->>'amount')::numeric,(d->>'payer_id')::uuid,
         d->>'payer_name',d->>'category',(d->>'spent_on')::date,
         coalesce(d->>'note',''),(d->>'created_by')::uuid,(d->>'created_at')::timestamptz,
         coalesce((d->>'reimbursed')::boolean,false),(d->>'reimbursed_at')::timestamptz,
         coalesce(d->>'currency','VND'),(d->>'original_amount')::numeric,(d->>'fx_rate')::numeric);
 elsif event.source_table='contributions' then
  if exists(select 1 from public.contributions where id=restored_id) then raise exception 'Contribution already restored'; end if;
  if not exists(select 1 from public.members where trip_id=p_trip_id and user_id=(d->>'payer_id')::uuid)
   then raise exception 'Cannot restore: original contributor is no longer in this trip'; end if;
  insert into public.contributions(id,trip_id,amount,payer_id,payer_name,note,paid_on,created_by,created_at)
  values(restored_id,p_trip_id,(d->>'amount')::numeric,(d->>'payer_id')::uuid,d->>'payer_name',
         coalesce(d->>'note',''),(d->>'paid_on')::date,(d->>'created_by')::uuid,(d->>'created_at')::timestamptz);
 end if;
 return restored_id;
end;
$$;
revoke all on function public.restore_trip_record(uuid,uuid) from public, anon, authenticated;
grant execute on function public.restore_trip_record(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
