ResellLedger
A responsive resale inventory and profit tracker for Pokémon cards, sports cards, electronics, video games, clothing, collectibles, and other products.
Features
Dark, mobile-friendly dashboard
Track individual inventory items and purchase costs
Record your own value estimates separately from bought cost and listed price; optional eBay deal search checks active listings, not sold prices
Categorize products and record their condition
Search online for item photos, then browse or take private item photos and store notes
Record sale prices, platform fees, shipping, and other sale expenses
Read sale screenshots locally to prefill recognized sale details
Calculate net proceeds and estimated profit or loss
Track pending payouts separately from paid sales
Record recovered capital and allocate positive sale profit between reinvestment and personal funds
View completed sales and lifetime profit
Review monthly and category profit reports, export sales CSVs, and back up or restore account data
Import eBay orders/sales CSVs and Listings Sales reports with preview, bought-cost entry, per-sale profit splits, and duplicate checks; summary reports use the report end date because they omit individual sale dates
Import an eBay All active listings CSV into inventory, expand available quantity into individual items, skip previously imported listings, and estimate bought cost with a percentage slider against listed price
Reset account inventory, sales, balances, categories, and stored item photos
Delete the signed-in account and its private photos through the in-app flow or public account-deletion page
Search and filter available inventory
Search current eBay listings in easy mode or advanced mode, with saved comparisons and CACHE sales used for cautious profit estimates
Duplicate item details when purchasing multiple copies
Project files
public/index.html — application structure
public/style.css — responsive styling
public/app.js — inventory, sales, and financial calculations
Run locally
Open public/index.html in a modern browser, or run npm run dev for Pages Functions support.
Publish with Cloudflare Pages
This repository uses Cloudflare Pages Functions in `functions/` and serves the static site from `public/`.
In Cloudflare Workers Builds, set the deploy command to `npm run deploy` (or `npx wrangler pages deploy public --project-name resell-ledger`). Keep the build command empty. Do not use `npx wrangler deploy`; that deploys a Worker and does not publish this Pages site and its Functions together.
For a Pages Git integration, set the build output directory to `public` and leave the build command empty.
The project name in `package.json` must match the existing Cloudflare Pages project if it is different from `resell-ledger`.
Data and privacy
CACHE uses Supabase email and password authentication. Inventory, sales, custom categories, and funds sync to a per-user Supabase record protected by row-level security. A per-account browser cache is also kept for resilience. Existing browser data is imported into the first account that signs in when that account has no cloud record.
Photos are resized to at most 1280 pixels and compressed as JPEG before upload to a private per-user Supabase Storage bucket. Existing embedded photos move to the bucket at next sign-in. Keep a separate backup of important financial records; CACHE backups include photo files.
Current limitations
OCR suggestions depend on screenshot quality and should be reviewed before saving.
The application needs browser verification before being relied on for real inventory or accounting.
Future development
Potential next steps are listed in TODO.md.
Supabase setup
Follow SUPABASE_SETUP.md to create the database table, enable email sign-in, and configure the live site URL.
Native app packaging is being prepared with Capacitor. The current app remains a PWA until iOS/Android projects are generated, deep links and native interactions are finished, and both platforms are tested. See APP_STORE_READINESS.md.

Optional Cloudflare server features
The eBay deal-search route lives in `functions/api/` and runs as a Cloudflare Pages Function. It is disabled unless explicitly enabled. Configure these **server-side** variables/secrets in the Cloudflare Pages project (Settings → Variables and Secrets):

- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` — the same project URL and browser-safe publishable/anon key used by CACHE; routes validate the signed-in user's access token.
- `ENABLE_EBAY_DEAL_SEARCH=true`, `EBAY_CLIENT_ID`, and `EBAY_CLIENT_SECRET` (secret) — enables active listing search through eBay Browse API. eBay requires Buy API production approval before production use; see its [Buy API requirements](https://developer.ebay.com/api-docs/buy/buy-requirements.html).

After changing server settings, redeploy the Pages project. Keep eBay secrets out of `supabase-config.js` and all browser files. eBay account linking and bulk listing publishing are not enabled: they need seller OAuth, production API access, token storage, and the seller's shipping, return, and payment policies. Receipt/document uploads currently accept images because the existing private Storage bucket accepts JPEG images only; PDF support needs a bucket policy/configuration change.

Recorded inventory values and sold comparisons are manual references. The deal finder uses eBay active listings and does not claim eBay sold-comparable access.
