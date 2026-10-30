create table if not exists public.cache_user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.cache_user_data enable row level security;
grant select, insert, update, delete on public.cache_user_data to authenticated;

drop policy if exists "Users can read their own CACHE data" on public.cache_user_data;
create policy "Users can read their own CACHE data"
on public.cache_user_data for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own CACHE data" on public.cache_user_data;
create policy "Users can create their own CACHE data"
on public.cache_user_data for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own CACHE data" on public.cache_user_data;
create policy "Users can update their own CACHE data"
on public.cache_user_data for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own CACHE data" on public.cache_user_data;
create policy "Users can delete their own CACHE data"
on public.cache_user_data for delete to authenticated
using ((select auth.uid()) = user_id);
