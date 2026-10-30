insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cache-item-photos', 'cache-item-photos', false, 4194304, array['image/jpeg'])
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "CACHE photo owners can read their files"
on storage.objects for select to authenticated
using (bucket_id = 'cache-item-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "CACHE photo owners can upload their files"
on storage.objects for insert to authenticated
with check (bucket_id = 'cache-item-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "CACHE photo owners can update their files"
on storage.objects for update to authenticated
using (bucket_id = 'cache-item-photos' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'cache-item-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "CACHE photo owners can delete their files"
on storage.objects for delete to authenticated
using (bucket_id = 'cache-item-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));
