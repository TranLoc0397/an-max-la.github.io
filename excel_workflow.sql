-- Add fields used by the workbook-style overview, fund tracking and expense notes.
alter table public.trips
 add column if not exists initial_fund numeric not null default 0;

alter table public.expenses
 add column if not exists note text not null default '';
