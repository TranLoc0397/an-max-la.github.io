-- Uneven expense splits. Run once in Supabase SQL Editor, AFTER expense_currency.sql.
-- expenses.split = null keeps today's behaviour: everyone in the trip shares the expense equally.
-- Otherwise {"mode":"equal"|"shares"|"exact","weights":{"<member user_id>":<number>,...}}.
-- 'exact' weights are amounts in the expense's entry currency (original currency for a foreign
-- expense, otherwise VND) and must add up to that total. Balances allocate proportionally to weights.
alter table public.expenses add column if not exists split jsonb;

create or replace function public.expense_split_valid(s jsonb,amount numeric,original numeric)
returns boolean language sql immutable as $$
 select s is null or (
  jsonb_typeof(s)='object'
  and s->>'mode' in ('equal','shares','exact')
  and jsonb_typeof(s->'weights')='object'
  and exists(select 1 from jsonb_each(s->'weights'))
  and not exists(
    select 1 from jsonb_each(s->'weights') w
    where w.key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(w.value)<>'number' or (w.value)::text::numeric<=0)
  and (s->>'mode'<>'exact' or abs(
    (select sum((w.value)::text::numeric) from jsonb_each(s->'weights') w)-coalesce(original,amount))<=0.01)
 )
$$;
alter table public.expenses drop constraint if exists expenses_split_shape;
alter table public.expenses add constraint expenses_split_shape check (public.expense_split_valid(split,amount,original_amount));

-- Everyone in a split must be a member of the trip.
create or replace function public.check_expense_split_members()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.split is not null and exists(
   select 1 from jsonb_object_keys(new.split->'weights') k
   where not exists(select 1 from public.members m where m.trip_id=new.trip_id and m.user_id::text=k))
 then raise exception 'Split includes someone who is not a member of this trip'; end if;
 return new;
end;
$$;
drop trigger if exists check_expense_split_members on public.expenses;
create trigger check_expense_split_members before insert or update of split,trip_id on public.expenses
 for each row execute function public.check_expense_split_members();

-- Used when restoring: drop people who left; an 'exact' split that lost someone becomes 'shares'
-- (same proportions, no longer has to add up); nothing left means "everyone, equally".
create or replace function public.clean_expense_split(p_trip_id uuid,s jsonb)
returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare kept jsonb;
begin
 if s is null or jsonb_typeof(s)<>'object' then return null; end if;
 select coalesce(jsonb_object_agg(w.key,w.value),'{}'::jsonb) into kept
 from jsonb_each(s->'weights') w
 where exists(select 1 from public.members m where m.trip_id=p_trip_id and m.user_id::text=w.key);
 if kept='{}'::jsonb then return null; end if;
 if kept=s->'weights' then return s; end if;
 return jsonb_build_object('mode',case when s->>'mode'='exact' then 'shares' else s->>'mode' end,'weights',kept);
end;
$$;

-- Removing a member who is part of a split would silently change everyone else's share.
create or replace function public.remove_trip_member_safe(p_trip_id uuid,p_member_user_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.members%rowtype; owner_id uuid;
begin
 if auth.uid() is null or not public.can_edit_trip(p_trip_id) then raise exception 'Editing permission required'; end if;
 select created_by into owner_id from public.trips where id=p_trip_id;
 select * into item from public.members where trip_id=p_trip_id and user_id=p_member_user_id for update;
 if not found then raise exception 'Member not found'; end if;
 if item.user_id=owner_id then raise exception 'Cannot remove the trip Host'; end if;
 if not item.is_guest and auth.uid()<>owner_id then raise exception 'Only the Host may remove a joined account'; end if;
 if exists(select 1 from public.expenses where trip_id=p_trip_id and payer_id=item.user_id)
   or exists(select 1 from public.contributions where trip_id=p_trip_id and payer_id=item.user_id)
   or exists(select 1 from public.member_debts where trip_id=p_trip_id and (debtor_id=item.user_id or creditor_id=item.user_id))
   or exists(select 1 from public.trip_payments where trip_id=p_trip_id and recorded_by=item.user_id)
   or exists(select 1 from public.expenses where trip_id=p_trip_id and split->'weights' ? item.user_id::text)
 then raise exception 'Member has financial records. Keep the member to preserve trip balances and payment history'; end if;
 delete from public.members where id=item.id;
end;
$$;
revoke all on function public.remove_trip_member_safe(uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_trip_member_safe(uuid,uuid) to authenticated;

-- Merging duplicates moves the source member's part of every split to the surviving member.
create or replace function public.merge_duplicate_trip_members(
 p_trip_id uuid,
 p_source_user_id uuid,
 p_target_user_id uuid
) returns jsonb
language plpgsql security definer
set search_path=public,pg_temp as $$
declare
 actor uuid:=auth.uid();
 host_id uuid;
 source_member public.members%rowtype;
 target_member public.members%rowtype;
 n_expenses integer;
 n_contributions integer;
 n_debts integer;
 n_members_before integer;
begin
 if actor is null then raise exception 'Sign in to merge members'; end if;
 select t.created_by into host_id from public.trips t where t.id=p_trip_id for update;
 if host_id is null or actor<>host_id then
  raise exception 'Only the Host can merge member records';
 end if;
 if p_source_user_id is null or p_target_user_id is null
    or p_source_user_id=p_target_user_id then
  raise exception 'Choose two different members';
 end if;
 if p_source_user_id=host_id or p_target_user_id=host_id then
  raise exception 'Host member cannot be merged';
 end if;

 -- Lock all trip members consistently to serialize concurrent merges.
 perform 1 from public.members
  where trip_id=p_trip_id order by user_id for update;
 select * into source_member from public.members
  where trip_id=p_trip_id and user_id=p_source_user_id;
 if not found then raise exception 'Source member not found'; end if;
 select * into target_member from public.members
  where trip_id=p_trip_id and user_id=p_target_user_id;
 if not found then raise exception 'Destination member not found'; end if;

 -- An email-linked member is a separate authenticated identity. Never move
 -- or delete that membership while merging financial records. In particular,
 -- assigning its account_user_id to a second row before deleting the first
 -- violates members_trip_account_unique. Both rows must be unlinked guests.
 if not source_member.is_guest or source_member.account_user_id is not null
    or not target_member.is_guest or target_member.account_user_id is not null then
  raise exception 'Cannot merge a member linked to an email account';
 end if;
 -- Pending email invitations are also protected: merging must not silently
 -- remove an invitation that the intended member has not accepted yet.
 if exists (
  select 1 from trip_private.member_email_invites i
  where i.trip_id=p_trip_id
    and i.member_user_id in (p_source_user_id,p_target_user_id)
 ) then raise exception 'Cannot merge a member with an email invitation'; end if;

 -- Two different financial parties may owe one another. Collapsing those
 -- into a single member would erase the distinction. Block these cases.
 if exists (
  select 1 from public.member_debts d
  where d.trip_id=p_trip_id
    and ((d.debtor_id=p_source_user_id and d.creditor_id=p_target_user_id)
      or (d.debtor_id=p_target_user_id and d.creditor_id=p_source_user_id))
 ) then raise exception 'Cannot merge: these members have a personal debt between them'; end if;

 select count(*) into n_members_before from public.members where trip_id=p_trip_id;
 select count(*) into n_expenses from public.expenses
  where trip_id=p_trip_id and payer_id=p_source_user_id;
 select count(*) into n_contributions from public.contributions
  where trip_id=p_trip_id and payer_id=p_source_user_id;
 select count(*) into n_debts from public.member_debts
  where trip_id=p_trip_id
    and (debtor_id=p_source_user_id or creditor_id=p_source_user_id);

 -- Neither row has a login account or pending invitation. Preserve all
 -- payment amounts and reference the surviving member's financial identity.
 -- Do not transfer account_user_id or change the unique account mapping.

 update public.expenses
  set payer_id=p_target_user_id,payer_name=target_member.name
  where trip_id=p_trip_id and payer_id=p_source_user_id;
 update public.contributions
  set payer_id=p_target_user_id,payer_name=target_member.name
  where trip_id=p_trip_id and payer_id=p_source_user_id;
 update public.member_debts
  set debtor_id=case when debtor_id=p_source_user_id
    then p_target_user_id else debtor_id end,
      creditor_id=case when creditor_id=p_source_user_id
    then p_target_user_id else creditor_id end
  where trip_id=p_trip_id
    and (debtor_id=p_source_user_id or creditor_id=p_source_user_id);

 -- Uneven splits: the surviving member takes over the source member's part.
 update public.expenses
  set split=jsonb_set(split,'{weights}',
    (split->'weights')-p_source_user_id::text
    || jsonb_build_object(p_target_user_id::text,
       case when split->>'mode'='equal' then 1
       else coalesce((split->'weights'->>p_target_user_id::text)::numeric,0)
            +(split->'weights'->>p_source_user_id::text)::numeric end))
  where trip_id=p_trip_id and split is not null and split->'weights' ? p_source_user_id::text;

 -- Pending access requests for the removed row are no longer actionable.
 -- Payment actor IDs and audit history are retained as historical attribution.
 delete from public.trip_edit_requests
  where trip_id=p_trip_id and user_id=p_source_user_id;
 delete from public.members
  where trip_id=p_trip_id and user_id=p_source_user_id;
 if not found then raise exception 'Source member could not be deleted'; end if;

 if (select count(*) from public.members where trip_id=p_trip_id)<>n_members_before-1 then
  raise exception 'Member count mismatch: aborting merge';
 end if;
 return jsonb_build_object(
  'source_name',source_member.name,'target_name',target_member.name,
  'members_before',n_members_before,'members_after',n_members_before-1,
  'expenses_moved',n_expenses,
  'contributions_moved',n_contributions,
  'debts_moved',n_debts
 );
end;
$$;
revoke all on function public.merge_duplicate_trip_members(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.merge_duplicate_trip_members(uuid,uuid,uuid)
 to authenticated;

-- Restoring a deleted expense keeps its split (cleaned of people who have since left).
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
                              currency,original_amount,fx_rate,split)
  values(restored_id,p_trip_id,d->>'title',(d->>'amount')::numeric,(d->>'payer_id')::uuid,
         d->>'payer_name',d->>'category',(d->>'spent_on')::date,
         coalesce(d->>'note',''),(d->>'created_by')::uuid,(d->>'created_at')::timestamptz,
         coalesce((d->>'reimbursed')::boolean,false),(d->>'reimbursed_at')::timestamptz,
         coalesce(d->>'currency','VND'),(d->>'original_amount')::numeric,(d->>'fx_rate')::numeric,
         public.clean_expense_split(p_trip_id,d->'split'));
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
