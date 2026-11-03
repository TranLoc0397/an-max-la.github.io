-- Member management: editor rename; safe deletion without cascade loss.
create or replace function public.update_trip_member_name(p_trip_id uuid,p_member_user_id uuid,p_name text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.can_edit_trip(p_trip_id) then raise exception 'Editing permission required'; end if;
 if nullif(trim(p_name),'') is null or length(trim(p_name))>40 then raise exception 'Name must be between 1 and 40 characters'; end if;
 if exists(select 1 from public.trips where id=p_trip_id and created_by=p_member_user_id)
    and auth.uid()<>p_member_user_id then
  raise exception 'Only the Host can rename their Host profile';
 end if;
 update public.members set name=trim(p_name)
 where trip_id=p_trip_id and user_id=p_member_user_id;
 if not found then raise exception 'Member not found'; end if;
 -- Keep denormalized payer labels aligned with the current display name.
 update public.expenses set payer_name=trim(p_name) where trip_id=p_trip_id and payer_id=p_member_user_id;
 update public.contributions set payer_name=trim(p_name) where trip_id=p_trip_id and payer_id=p_member_user_id;
end;
$$;
revoke all on function public.update_trip_member_name(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.update_trip_member_name(uuid,uuid,text) to authenticated;

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
 then raise exception 'Member has financial records. Keep the member to preserve trip balances and payment history'; end if;
 delete from public.members where id=item.id;
end;
$$;
revoke all on function public.remove_trip_member_safe(uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_trip_member_safe(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
