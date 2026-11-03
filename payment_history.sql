-- TripTogether phase 2: payments + immutable audit events.
-- Existing expenses, contributions and debt rows are not deleted or reset.
create table if not exists public.trip_payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  expense_id uuid references public.expenses(id) on delete cascade,
  debt_id uuid references public.member_debts(id) on delete cascade,
  amount numeric not null check (amount <> 0 and amount = trunc(amount)),
  paid_on date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  note text not null default '',
  recorded_by uuid,
  created_at timestamptz not null default now(),
  constraint exactly_one_payment_target check ((expense_id is not null) <> (debt_id is not null))
);
create index if not exists trip_payments_trip_date on public.trip_payments(trip_id,created_at desc);
create index if not exists trip_payments_expense on public.trip_payments(expense_id) where expense_id is not null;
create index if not exists trip_payments_debt on public.trip_payments(debt_id) where debt_id is not null;
alter table public.trip_payments enable row level security;
drop policy if exists "trip members read payments" on public.trip_payments;
create policy "trip members read payments" on public.trip_payments
  for select to authenticated using (public.is_trip_member(trip_id));
revoke all on public.trip_payments from public, anon, authenticated;
grant select on public.trip_payments to authenticated;

-- Preserve historically completed payments, if any, during first installation.
insert into public.trip_payments(trip_id,expense_id,amount,paid_on,note,recorded_by)
select e.trip_id,e.id,e.amount,coalesce((e.reimbursed_at at time zone 'Asia/Ho_Chi_Minh')::date,e.spent_on),
       'Imported completed reimbursement',e.created_by
from public.expenses e
where e.payer_id is not null and e.reimbursed
  and not exists(select 1 from public.trip_payments p where p.expense_id=e.id);
insert into public.trip_payments(trip_id,debt_id,amount,paid_on,note,recorded_by)
select d.trip_id,d.id,d.amount,coalesce((d.settled_at at time zone 'Asia/Ho_Chi_Minh')::date,d.incurred_on),
       'Imported completed debt',d.created_by
from public.member_debts d
where d.is_settled
  and not exists(select 1 from public.trip_payments p where p.debt_id=d.id);

create table if not exists public.trip_activity (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id) on delete cascade,
 source_table text not null,
 action text not null check(action in ('INSERT','UPDATE','DELETE')),
 record_id uuid not null,
 actor_id uuid,
 before_data jsonb,
 after_data jsonb,
 recorded_at timestamptz not null default now()
);
create index if not exists trip_activity_trip_created on public.trip_activity(trip_id,recorded_at desc);
alter table public.trip_activity enable row level security;
drop policy if exists "trip members read activity" on public.trip_activity;
create policy "trip members read activity" on public.trip_activity
 for select to authenticated using(public.is_trip_member(trip_id));
revoke all on public.trip_activity from public, anon, authenticated;
grant select on public.trip_activity to authenticated;

create or replace function public.log_trip_activity()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare before_row jsonb; after_row jsonb; current_row jsonb;
begin
 before_row := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end;
 after_row := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end;
 current_row := coalesce(after_row,before_row);
 insert into public.trip_activity(trip_id,source_table,action,record_id,actor_id,before_data,after_data)
 values((current_row->>'trip_id')::uuid,TG_TABLE_NAME,TG_OP,(current_row->>'id')::uuid,auth.uid(),before_row,after_row);
 return coalesce(NEW,OLD);
end;
$$;
revoke all on function public.log_trip_activity() from public, anon, authenticated;
drop trigger if exists audit_expenses on public.expenses;
create trigger audit_expenses after insert or update or delete on public.expenses
for each row execute function public.log_trip_activity();
drop trigger if exists audit_contributions on public.contributions;
create trigger audit_contributions after insert or update or delete on public.contributions
for each row execute function public.log_trip_activity();
drop trigger if exists audit_member_debts on public.member_debts;
create trigger audit_member_debts after insert or update or delete on public.member_debts
for each row execute function public.log_trip_activity();
drop trigger if exists audit_trip_payments on public.trip_payments;
create trigger audit_trip_payments after insert or update or delete on public.trip_payments
for each row execute function public.log_trip_activity();

-- Prevent editing the original total below the already-recorded payment amount.
create or replace function public.guard_paid_record()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare already_paid numeric;
begin
 if TG_TABLE_NAME='expenses' then
  select coalesce(sum(amount),0) into already_paid from public.trip_payments where expense_id=NEW.id;
  if already_paid>0 and (NEW.payer_id is null or NEW.amount < already_paid)
   then raise exception 'Cannot change a paid expense below its reimbursed amount'; end if;
  if NEW.reimbursed is distinct from (already_paid=NEW.amount)
   then raise exception 'Update reimbursement through record_trip_payment'; end if;
 elsif TG_TABLE_NAME='member_debts' then
  select coalesce(sum(amount),0) into already_paid from public.trip_payments where debt_id=NEW.id;
  if already_paid>NEW.amount then raise exception 'Cannot change debt below its paid amount'; end if;
  if NEW.is_settled is distinct from (already_paid=NEW.amount)
   then raise exception 'Update debt payment through record_trip_payment'; end if;
 end if;
 return NEW;
end;
$$;
drop trigger if exists guard_paid_expenses on public.expenses;
create trigger guard_paid_expenses before update on public.expenses
 for each row execute function public.guard_paid_record();
drop trigger if exists guard_paid_debts on public.member_debts;
create trigger guard_paid_debts before update on public.member_debts
 for each row execute function public.guard_paid_record();

create or replace function public.record_trip_payment(
 p_trip_id uuid,p_kind text,p_reference_id uuid,p_amount numeric,p_note text default ''
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare cap numeric; previous numeric; ref_trip uuid; new_id uuid;
begin
 if auth.uid() is null or not public.can_edit_trip(p_trip_id) then
  raise exception 'Editing permission required';
 end if;
 if p_kind not in ('expense','debt') then raise exception 'Invalid payment kind'; end if;
 if p_amount is null or p_amount=0 or p_amount<>trunc(p_amount) then raise exception 'Payment amount must be a nonzero whole VND amount'; end if;
 if length(coalesce(p_note,''))>200 then raise exception 'Note too long'; end if;
 if p_kind='expense' then
  select e.trip_id,e.amount into ref_trip,cap from public.expenses e
  where e.id=p_reference_id and e.payer_id is not null for update;
  if ref_trip is distinct from p_trip_id then raise exception 'Expense not found in this trip or paid directly by fund'; end if;
  select coalesce(sum(amount),0) into previous from public.trip_payments where expense_id=p_reference_id;
 else
  select d.trip_id,d.amount into ref_trip,cap from public.member_debts d
  where d.id=p_reference_id for update;
  if ref_trip is distinct from p_trip_id then raise exception 'Debt not found in this trip'; end if;
  select coalesce(sum(amount),0) into previous from public.trip_payments where debt_id=p_reference_id;
 end if;
 if previous+p_amount<0 or previous+p_amount>cap then
  raise exception 'Payment must leave an outstanding amount between 0 and the original total';
 end if;
 insert into public.trip_payments(trip_id,expense_id,debt_id,amount,paid_on,note,recorded_by)
 values(p_trip_id,case when p_kind='expense' then p_reference_id else null end,
                  case when p_kind='debt' then p_reference_id else null end,
        p_amount,(now() at time zone 'Asia/Ho_Chi_Minh')::date,coalesce(p_note,''),auth.uid())
 returning id into new_id;
 if p_kind='expense' then
  update public.expenses set reimbursed=(previous+p_amount=cap),
   reimbursed_at=case when previous+p_amount=cap then now() else null end
  where id=p_reference_id;
 else
  update public.member_debts set is_settled=(previous+p_amount=cap),
   settled_at=case when previous+p_amount=cap then now() else null end
  where id=p_reference_id;
 end if;
 return new_id;
end;
$$;
revoke all on function public.record_trip_payment(uuid,text,uuid,numeric,text) from public, anon, authenticated;
grant execute on function public.record_trip_payment(uuid,text,uuid,numeric,text) to authenticated;
notify pgrst, 'reload schema';

-- Shared-link viewers can see payment totals with the same invite-code possession as the trip.
create or replace function public.get_shared_trip_payments(p_invite_code uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare trip_key uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select id into trip_key from public.trips where invite_code=p_invite_code;
 if trip_key is null then raise exception 'Invalid invitation link'; end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'id',p.id,'expense_id',p.expense_id,'debt_id',p.debt_id,
   'amount',p.amount,'paid_on',p.paid_on,'note',p.note,'created_at',p.created_at
  ) order by p.created_at,p.id)
  from public.trip_payments p where p.trip_id=trip_key
 ),'[]'::jsonb);
end;
$$;
revoke all on function public.get_shared_trip_payments(uuid) from public, anon, authenticated;
grant execute on function public.get_shared_trip_payments(uuid) to authenticated;

-- Editors can restore an accidentally deleted expense or contribution using its immutable audit snapshot.
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
 -- Paid expenses require full-ledger recovery, not a partial record-only restore.
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
                              note,created_by,created_at,reimbursed,reimbursed_at)
  values(restored_id,p_trip_id,d->>'title',(d->>'amount')::numeric,(d->>'payer_id')::uuid,
         d->>'payer_name',d->>'category',(d->>'spent_on')::date,
         coalesce(d->>'note',''),(d->>'created_by')::uuid,(d->>'created_at')::timestamptz,
         coalesce((d->>'reimbursed')::boolean,false),(d->>'reimbursed_at')::timestamptz);
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
