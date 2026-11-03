-- Creating new trips requires a permanent (non-anonymous) Supabase account.
-- Existing anonymous trip Hosts retain access to the trips they already created.
-- Existing permissive policy "create own trips" still checks created_by = auth.uid().
-- This restrictive policy ensures no other permissive INSERT policy can bypass this rule.
drop policy if exists "only registered users create trips" on public.trips;
create policy "only registered users create trips" on public.trips
 as restrictive for insert to authenticated
 with check ((select coalesce((auth.jwt()->>'is_anonymous')::boolean,true)) = false);
