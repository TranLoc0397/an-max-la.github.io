-- Host-only merge for duplicate participant rows.
-- Apply ONLY after review and before deploying the matching UI.
-- Run after verified_email_member_linking.sql; uses members.account_user_id.
-- All updates and deletion execute atomically in one RPC transaction.
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
 source_login uuid;
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

 -- Never merge two distinct signed-in accounts or silently revoke access.
 if not source_member.is_guest and not target_member.is_guest then
  raise exception 'Two linked accounts cannot be merged automatically';
 end if;
 if source_member.account_user_id is not null and target_member.account_user_id is not null then
  raise exception 'Both members have linked accounts';
 end if;
 if not source_member.is_guest then
  if not target_member.is_guest or target_member.account_user_id is not null then
   raise exception 'Destination must be an unlinked manually added member';
  end if;
  source_login:=coalesce(source_member.account_user_id,source_member.user_id);
 end if;

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

 -- Preserve the signed-in account and edit privilege of the deleted row.
 -- The destination user_id stays unchanged for expense/debt foreign keys.
 if source_login is not null then
  update public.members
   set account_user_id=source_login,
       is_guest=false,
       can_edit=(target_member.can_edit or source_member.can_edit)
   where trip_id=p_trip_id and user_id=p_target_user_id;
 end if;

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

 -- Pending access requests for the removed row are no longer actionable.
 -- Payment actor IDs and audit history are retained as historical attribution.
 delete from public.trip_edit_requests
  where trip_id=p_trip_id and user_id=p_source_user_id;
 -- Discard any outstanding unclaimed email invitation for these rows:
 -- the Host may reassign a fresh email to the destination afterwards.
 delete from trip_private.member_email_invites
  where trip_id=p_trip_id and member_user_id in (p_source_user_id,p_target_user_id);

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
notify pgrst,'reload schema';
