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

The connected CACHE project has the private `cache-item-photos` bucket and its migration recorded. For a different project, run `supabase/migrations/20261030032412_private_item_photos.sql` after the base schema. It accepts JPEGs up to 4 MB, and its policies only allow signed-in users to access objects under their own user ID folder. New photos are resized and uploaded there; embedded photos are migrated the next time their owner signs in. The app stores object paths in the account record and uses short-lived signed URLs to display them.

The dashboard includes monthly and category profit reports, CSV sales export, and JSON backup and restore. Backups embed photo data so they can be restored into another CACHE account. Sale screenshot OCR runs in the browser; screenshot contents are not sent to a recognition service. Review all OCR-filled fields before saving.
