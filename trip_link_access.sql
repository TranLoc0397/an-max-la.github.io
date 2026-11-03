-- Link-only trip viewing. The random invite_code UUID is a bearer viewing credential.
-- Anyone with the link can view the trip; they must join and be approved to edit.
-- Keep existing RPC signatures for compatibility with already-cached mobile clients.
-- Existing passcode hashes are retained but no longer consulted.
create or replace function public.get_shared_trip(p_invite_code uuid,p_passcode text default null)
returns jsonb language plpgsql security definer set search_path=public,extensions
as $$
declare t public.trips%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into t from public.trips where invite_code=p_invite_code;
 if t.id is null then raise exception 'Invalid invitation link'; end if;
 return jsonb_build_object(
  'trip',(to_jsonb(t)-'view_passcode_hash')||jsonb_build_object('view_passcode_set',false),
  'members',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.members m where m.trip_id=t.id),'[]'::jsonb),
  'expenses',coalesce((select jsonb_agg(to_jsonb(e) order by e.spent_on desc) from public.expenses e where e.trip_id=t.id),'[]'::jsonb),
  'contributions',coalesce((select jsonb_agg(to_jsonb(c) order by c.paid_on desc) from public.contributions c where c.trip_id=t.id),'[]'::jsonb),
  'debts',coalesce((select jsonb_agg(to_jsonb(d) order by d.incurred_on desc) from public.member_debts d where d.trip_id=t.id),'[]'::jsonb)
 );
end;
$$;

create or replace function public.join_trip(p_invite_code uuid,p_name text,p_passcode text default null)
returns uuid language plpgsql security definer set search_path=public,extensions
as $$
declare t public.trips%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into t from public.trips where invite_code=p_invite_code;
 if t.id is null then raise exception 'Invalid invitation link'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'A display name is required'; end if;
 -- Joining NEVER grants edit access to a new member.
 insert into public.members(trip_id,user_id,name,can_edit)
 values(t.id,auth.uid(),left(trim(p_name),40),t.created_by=auth.uid())
 on conflict(trip_id,user_id) do update set name=excluded.name;
 return t.id;
end;
$$;
revoke all on function public.get_shared_trip(uuid,text) from public,anon;
revoke all on function public.join_trip(uuid,text,text) from public,anon;
grant execute on function public.get_shared_trip(uuid,text) to authenticated;
grant execute on function public.join_trip(uuid,text,text) to authenticated;
notify pgrst, 'reload schema';
