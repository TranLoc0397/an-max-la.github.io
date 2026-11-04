-- Read-only trip members must see the same financial records as an invite-link viewer.
-- Previously the ALL policies required can_edit_trip() even for SELECT, silently
-- returning empty rows to a member waiting for Host approval.
-- This migration does NOT modify trip, member, expense or contribution data.
-- Retain existing "editors manage ..." policies for INSERT/UPDATE/DELETE.
begin;
create policy "trip members read expenses"
  on public.expenses for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "trip members read contributions"
  on public.contributions for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "trip members read personal debts"
  on public.member_debts for select to authenticated
  using (public.is_trip_member(trip_id));
commit;

-- Post-install verification:
-- SELECT tablename, policyname, cmd, qual FROM pg_policies
-- WHERE schemaname='public' AND tablename IN ('expenses','contributions','member_debts');
