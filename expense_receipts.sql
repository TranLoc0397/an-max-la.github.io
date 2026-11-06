-- Apply via Supabase SQL Editor BEFORE deploying the receipt UI.
-- Private receipt images; public links are deliberately disabled.
alter table public.expenses
  add column if not exists receipt_path text;
alter table public.expenses
  drop constraint if exists expenses_receipt_path_shape;
alter table public.expenses
  add constraint expenses_receipt_path_shape check (
    receipt_path is null or (
      receipt_path ~ ('^' || trip_id::text || '/' || id::text || '/[0-9a-f-]{36}\\.(jpg|png|webp)$')
      and length(receipt_path) <= 200
    )
  );

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('trip-receipts','trip-receipts',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "trip receipts read" on storage.objects;
create policy "trip receipts read" on storage.objects
for select to authenticated using (
  bucket_id='trip-receipts'
  and (
    public.is_trip_member(((storage.foldername(name))[1])::uuid)
    or exists (
      select 1 from public.trips t
      where t.id=((storage.foldername(name))[1])::uuid
        and t.created_by=(select auth.uid())
    )
  )
);
drop policy if exists "trip receipts upload" on storage.objects;
create policy "trip receipts upload" on storage.objects
for insert to authenticated with check (
  bucket_id='trip-receipts'
  and array_length(storage.foldername(name),1)=3
  and public.can_edit_trip(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
  and storage.extension(name) in ('jpg','png','webp')
);
drop policy if exists "trip receipts delete" on storage.objects;
create policy "trip receipts delete" on storage.objects
for delete to authenticated using (
  bucket_id='trip-receipts'
  and public.can_edit_trip(((storage.foldername(name))[1])::uuid)
);
-- No UPDATE policy: immutable, randomly named files uploaded with upsert:false.
-- SQL migration doesn't delete storage objects for historic expense deletes;
-- the client removes receipt files after a successful expense deletion.
