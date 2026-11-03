-- Apply once in Supabase SQL Editor AFTER member_edit_permissions.sql.
-- Members may request editing; only the trip creator can approve or reject.
create table if not exists public.trip_edit_requests (
 trip_id uuid not null references public.trips(id) on delete cascade,
 user_id uuid not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 primary key (trip_id,user_id),
 foreign key (trip_id,user_id) references public.members(trip_id,user_id) on delete cascade
);
create index if not exists trip_edit_requests_pending_idx on public.trip_edit_requests(trip_id,status);
alter table public.trip_edit_requests enable row level security;
-- No direct table access: all changes go through checked RPCs.
revoke all on public.trip_edit_requests from public,anon,authenticated;

create or replace function public.request_trip_edit_access(p_trip_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if auth.uid() is null or not exists(
  select 1 from public.members m where m.trip_id=p_trip_id and m.user_id=auth.uid() and not m.is_guest
 ) then raise exception 'Join the trip before requesting edit access'; end if;
 if public.can_edit_trip(p_trip_id) then raise exception 'You already have edit access'; end if;
 insert into public.trip_edit_requests(trip_id,user_id,status,requested_at,reviewed_at)
 values(p_trip_id,auth.uid(),'pending',now(),null)
 on conflict(trip_id,user_id) do update
  set status='pending',requested_at=now(),reviewed_at=null
  where public.trip_edit_requests.status='rejected';
end;
$$;
revoke all on function public.request_trip_edit_access(uuid) from public;
grant execute on function public.request_trip_edit_access(uuid) to authenticated;

create or replace function public.list_trip_edit_requests(p_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare is_host boolean;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select exists(select 1 from public.trips where id=p_trip_id and created_by=auth.uid()) into is_host;
 if not is_host and not exists(
  select 1 from public.members where trip_id=p_trip_id and user_id=auth.uid()
 ) then raise exception 'Trip membership required'; end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'user_id',r.user_id,'name',m.name,'status',r.status,'requested_at',r.requested_at
  ) order by r.requested_at desc)
  from public.trip_edit_requests r join public.members m
   on m.trip_id=r.trip_id and m.user_id=r.user_id
  where r.trip_id=p_trip_id and (is_host or r.user_id=auth.uid())
 ),'[]'::jsonb);
end;
$$;
revoke all on function public.list_trip_edit_requests(uuid) from public;
grant execute on function public.list_trip_edit_requests(uuid) to authenticated;

create or replace function public.review_trip_edit_request(
 p_trip_id uuid,p_member_user_id uuid,p_approve boolean
)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if auth.uid() is null or not exists(
  select 1 from public.trips where id=p_trip_id and created_by=auth.uid()
 ) then raise exception 'Only the Host can review edit requests'; end if;
 -- Lock pending request to prevent double review.
 perform 1 from public.trip_edit_requests
  where trip_id=p_trip_id and user_id=p_member_user_id and status='pending' for update;
 if not found then raise exception 'Pending request not found'; end if;
 if p_approve then
  update public.members set can_edit=true
   where trip_id=p_trip_id and user_id=p_member_user_id and not is_guest;
  if not found then raise exception 'Joined member not found'; end if;
 end if;
 update public.trip_edit_requests
  set status=case when p_approve then 'approved' else 'rejected' end, reviewed_at=now()
  where trip_id=p_trip_id and user_id=p_member_user_id and status='pending';
end;
$$;
revoke all on function public.review_trip_edit_request(uuid,uuid,boolean) from public;
grant execute on function public.review_trip_edit_request(uuid,uuid,boolean) to authenticated;
-- Supabase may grant EXECUTE to anon explicitly through default privileges.
revoke execute on function public.request_trip_edit_access(uuid) from anon;
revoke execute on function public.list_trip_edit_requests(uuid) from anon;
revoke execute on function public.review_trip_edit_request(uuid,uuid,boolean) from anon;
notify pgrst, 'reload schema';
