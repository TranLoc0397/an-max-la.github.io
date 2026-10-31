-- Allow expenses paid directly from the shared fund to have no individual payer.
alter table public.expenses
  alter column payer_id drop not null;

notify pgrst, 'reload schema';
