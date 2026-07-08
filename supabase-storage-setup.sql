insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-photos',
  'story-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "story photos public read" on storage.objects;
drop policy if exists "story photos anon upload" on storage.objects;
drop policy if exists "story photos anon update" on storage.objects;

create policy "story photos public read"
on storage.objects
for select
using (bucket_id = 'story-photos');

create policy "story photos anon upload"
on storage.objects
for insert
to anon
with check (bucket_id = 'story-photos');

create policy "story photos anon update"
on storage.objects
for update
to anon
using (bucket_id = 'story-photos')
with check (bucket_id = 'story-photos');
