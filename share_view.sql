-- Allow anyone with a trip share link to view the trip without joining or entering a name.
create or replace function public.get_shared_trip(p_invite_code uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare t public.trips%rowtype;
begin
 select * into t from public.trips where invite_code=p_invite_code;
 if not found then raise exception 'Invalid invitation link'; end if;
 return jsonb_build_object(
  'trip',to_jsonb(t),
  'members',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.members m where m.trip_id=t.id),'[]'::jsonb),
  'expenses',coalesce((select jsonb_agg(to_jsonb(e) order by e.spent_on desc) from public.expenses e where e.trip_id=t.id),'[]'::jsonb),
  'contributions',coalesce((select jsonb_agg(to_jsonb(c) order by c.paid_on desc) from public.contributions c where c.trip_id=t.id),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.get_shared_trip(uuid) from public;
grant execute on function public.get_shared_trip(uuid) to authenticated;
notify pgrst, 'reload schema';
