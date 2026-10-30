# CACHE Supabase setup

The app now uses Supabase Auth for email and password sign-in and stores each account's inventory, sales, categories, and funds in one row in `public.cache_user_data`.

## 1. Create the table and access rules

In the Supabase dashboard for project `owtmgkmrmabmyhblooii`, open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. The table has row-level security policies that restrict every read and write to the signed-in user's own row.

## 2. Configure email sign-in

In **Authentication → Providers**, enable Email. Keep email confirmation enabled if you want new accounts to confirm their address before signing in. In **Authentication → URL Configuration**, set the Site URL to the live CACHE site address and add that same address to the allowed redirect URLs.

## 3. Publish the app

Keep `supabase-config.js` beside `index.html`, `app.js`, and `style.css` when publishing the static site. It contains the project URL and publishable key. The publishable key is intended for browser use; never put a Supabase service-role key in this project.

## Existing browser records

After the first successful sign-in, the app imports the existing `resellledger_data_v1` browser record into that account if the account has no cloud record yet. Future changes are saved to Supabase and a per-account local cache. Use the same login on each device to see the same cloud data.

Photos remain embedded in the saved item data, matching the current app behavior. Large inventories with many photos can make sync slower; a dedicated private Storage bucket is a good next improvement.
