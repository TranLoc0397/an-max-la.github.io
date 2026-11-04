-- Email-verified member claiming without changing financial member IDs.
-- REVIEW ONLY: apply in Supabase only after PR approval, before deploying web assets.
begin;
alter table public.members add column if not exists account_user_id uuid;
create unique index if not exists members_trip_account_unique on public.members(trip_id,account_user_id) where account_user_id is not null;
create schema if not exists trip_private;
revoke all on schema trip_private from public, anon, authenticated;
create table if not exists trip_private.member_email_invites(
  trip_id uuid not null,
  member_user_id uuid not null,
  invited_email text not null,
  assigned_at timestamptz not null default now(),
  primary key(trip_id,member_user_id),
  unique(trip_id,invited_email),
  constraint member_email_invites_member_fk foreign key (trip_id,member_user_id)
    references public.members(trip_id,user_id) on delete cascade,
  constraint member_email_not_empty check(length(trim(invited_email)) between 3 and 254 and invited_email=lower(trim(invited_email)))
);
revoke all on trip_private.member_email_invites from public, anon, authenticated;

create or replace function public.is_trip_member(tid uuid)
returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
 select exists(
  select 1 from public.members
  where trip_id=tid and (user_id=auth.uid() or account_user_id=auth.uid())
 );
$$;

create or replace function public.can_edit_trip(tid uuid)
returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
 select exists(select 1 from public.trips where id=tid and created_by=auth.uid())
 or exists(select 1 from public.members
  where trip_id=tid and (user_id=auth.uid() or account_user_id=auth.uid()) and can_edit);
$$;

create or replace function public.set_trip_member_invite_email(
 p_trip_id uuid,p_member_user_id uuid,p_email text
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare normalized text:=lower(trim(coalesce(p_email,'')));
begin
 if auth.uid() is null or not exists(
   select 1 from public.trips where id=p_trip_id and created_by=auth.uid()
 ) then raise exception 'Host permission required'; end if;
 if normalized<>'' and (length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 then raise exception 'Invalid invitation email'; end if;
 if not exists(
   select 1 from public.members where trip_id=p_trip_id and user_id=p_member_user_id
   and is_guest and account_user_id is null
 ) then raise exception 'Select an unlinked manually added member'; end if;
 if normalized='' then
   delete from trip_private.member_email_invites where trip_id=p_trip_id and member_user_id=p_member_user_id;
 else
   insert into trip_private.member_email_invites(trip_id,member_user_id,invited_email)
   values(p_trip_id,p_member_user_id,normalized)
   on conflict(trip_id,member_user_id) do update
    set invited_email=excluded.invited_email,assigned_at=now();
 end if;
end;
$$;

create or replace function public.get_trip_member_invite_emails(p_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not exists(
  select 1 from public.trips where id=p_trip_id and created_by=auth.uid()
 ) then raise exception 'Host permission required'; end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('member_user_id',i.member_user_id,'email',i.invited_email))
  from trip_private.member_email_invites i where i.trip_id=p_trip_id
 ),'[]'::jsonb);
end;
$$;

create or replace function public.claim_existing_trip_member(p_invite_code uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();mail text;tid uuid;mid uuid;
begin
 if uid is null then raise exception 'Sign in first'; end if;
 select lower(trim(email)) into mail from auth.users
 where id=uid and email_confirmed_at is not null and not is_anonymous;
 if mail is null then raise exception 'A verified email account is required'; end if;
 select id into tid from public.trips where invite_code=p_invite_code;
 if tid is null then raise exception 'Invalid trip invitation'; end if;
 -- Never create a new member or merge with an existing different financial record.
 if exists(select 1 from public.members
  where trip_id=tid and (user_id=uid or account_user_id=uid))
 then raise exception 'Account already belongs to this trip'; end if;
 select i.member_user_id into mid
 from trip_private.member_email_invites i
 join public.members m on m.trip_id=i.trip_id and m.user_id=i.member_user_id
 where i.trip_id=tid and i.invited_email=mail and m.is_guest and m.account_user_id is null
 for update of m;
 if mid is null then raise exception 'No unclaimed member is invited for this verified email'; end if;
 update public.members set account_user_id=uid,is_guest=false
 where trip_id=tid and user_id=mid and account_user_id is null;
 -- Keep members.user_id unchanged: expenses, contributions, debts and payments
 -- continue referring to the exact same financial participant.
 return tid;
end;
$$;

-- Old join_trip RPC must not add new rows via the public share link.
-- Host can still initialize its own member record when creating a trip.
create or replace function public.join_trip(
 p_invite_code uuid,p_name text,p_passcode text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare tid uuid;owner_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select id,created_by into tid,owner_id from public.trips where invite_code=p_invite_code;
 if tid is null then raise exception 'Invalid trip'; end if;
 if exists(select 1 from public.members where trip_id=tid
  and (user_id=auth.uid() or account_user_id=auth.uid())) then return tid; end if;
 if owner_id<>auth.uid() then
  raise exception 'Ask the Host to link your verified email to an existing member';
 end if;
 if length(trim(coalesce(p_name,'')))<1 then raise exception 'Name required'; end if;
 insert into public.members(trip_id,user_id,name,can_edit)
 values(tid,auth.uid(),left(trim(p_name),40),true)
 on conflict(trip_id,user_id) do nothing;
 return tid;
end;
$$;

-- Read-only joined members must see financial data. Keep editor-only writes.
do $$
begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='expenses'
  and policyname='trip members read expenses') then
  create policy "trip members read expenses" on public.expenses for select
   to authenticated using (public.is_trip_member(trip_id));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='contributions'
  and policyname='trip members read contributions') then
  create policy "trip members read contributions" on public.contributions for select
   to authenticated using (public.is_trip_member(trip_id));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='member_debts'
  and policyname='trip members read personal debts') then
  create policy "trip members read personal debts" on public.member_debts for select
   to authenticated using (public.is_trip_member(trip_id));
 end if;
end $$;

revoke all on function public.set_trip_member_invite_email(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.get_trip_member_invite_emails(uuid) from public,anon,authenticated;
revoke all on function public.claim_existing_trip_member(uuid) from public,anon,authenticated;
grant execute on function public.set_trip_member_invite_email(uuid,uuid,text) to authenticated;
grant execute on function public.get_trip_member_invite_emails(uuid) to authenticated;
grant execute on function public.claim_existing_trip_member(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
