-- Install before deploying the matching TripTogether UI update.
-- Creates a manually added guest and an optional initial contribution atomically.
-- A blank or zero amount creates only the guest; a positive amount creates
-- a normal contribution attributed to the new guest.
create or replace function public.add_guest_member_with_fund(
  p_trip_id uuid,
  p_name text,
  p_amount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  guest_id uuid;
  guest_name text := trim(coalesce(p_name,''));
  actor uuid := auth.uid();
begin
  if actor is null or not public.can_edit_trip(p_trip_id) then
    raise exception 'Editing permission required';
  end if;
  if length(guest_name) < 1 or length(guest_name) > 40 then
    raise exception 'Member name must contain 1-40 characters';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 999999999999
     or p_amount <> trunc(p_amount) then
    raise exception 'Opening fund must be a non-negative whole VND amount';
  end if;

  guest_id := gen_random_uuid();
  insert into public.members (trip_id, user_id, name, is_guest)
  values (p_trip_id, guest_id, guest_name, true);

  if p_amount > 0 then
    insert into public.contributions
      (trip_id, payer_id, payer_name, amount, note, paid_on, created_by)
    values
      (p_trip_id, guest_id, guest_name, p_amount,
       'Đóng quỹ khi thêm thành viên',
       (now() at time zone 'Asia/Ho_Chi_Minh')::date,
       actor);
  end if;
  return guest_id;
end;
$$;
revoke all on function public.add_guest_member_with_fund(uuid,text,numeric) from public, anon, authenticated;
grant execute on function public.add_guest_member_with_fund(uuid,text,numeric) to authenticated;
notify pgrst, 'reload schema';
