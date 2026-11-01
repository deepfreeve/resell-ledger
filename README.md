ResellLedger
A responsive resale inventory and profit tracker for Pokémon cards, sports cards, electronics, video games, clothing, collectibles, and other products.
Features
Dark, mobile-friendly dashboard
Track individual inventory items and purchase costs
Record card market values separately from bought cost and listed price; review source, condition/grade, and price freshness
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
Reset account inventory, sales, balances, categories, and stored item photos
Search and filter available inventory
Duplicate item details when purchasing multiple copies
Project files
index.html — application structure
style.css — responsive styling
app.js — inventory, sales, and financial calculations
Run locally
Open index.html in a modern browser, or serve the project using a local development server.
Publish with Cloudflare Pages
Push the project files to a GitHub repository.
Open the Cloudflare dashboard.
Navigate to Workers & Pages.
Create a Pages project and connect the GitHub repository.
For this plain HTML, CSS, and JavaScript project, leave the build command empty.
Set the build output directory to / if Cloudflare offers that setting for your deployment.
Deploy the project and open the generated pages.dev address.
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

Optional Cloudflare server features
The AI photo-to-draft and eBay active-listing search routes live in `functions/api/` and run as Cloudflare Pages Functions. They are disabled unless explicitly enabled. Configure these **server-side** variables/secrets in the Cloudflare Pages project (Settings → Variables and Secrets):

- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` — the same project URL and browser-safe publishable/anon key used by CACHE; routes validate the signed-in user's access token.
- `ENABLE_AI_GENERATION=true`, `OPENAI_API_KEY` (secret), and `OPENAI_MODEL` — enables AI drafts. Use an available Responses API model that supports image input and structured outputs. Apply Cloudflare rate limiting to `/api/ai-draft` before enabling it, because each request uses paid API capacity.
- `ENABLE_EBAY_DEAL_SEARCH=true`, `EBAY_CLIENT_ID`, and `EBAY_CLIENT_SECRET` (secret) — enables active listing search through eBay Browse API. The feature compares those listings with CACHE's own verified sales and manually recorded comps; it does not provide eBay sold-comparable data.
- `ENABLE_CARD_PRICING=true` and `JUSTTCG_API_KEY` (secret) — enables the current JustTCG card-match and market-value lookup for supported TCGs. The card-price route uses JustTCG's v2 API, which is currently marked beta; graded prices are only available when that exact grade has recent sale coverage. CACHE saves a price only after the user selects a matching card and variant. Configure a paid plan with commercial rights before displaying provider data in a public/commercial CACHE service.

After changing server settings, redeploy the Pages project. Keep eBay and AI secrets out of `supabase-config.js` and all browser files. eBay account linking and listing publishing are not enabled: they need seller OAuth, production API access, token storage, and the seller's shipping, return, and payment policies. Receipt/document uploads currently accept images because the existing private Storage bucket accepts JPEG images only; PDF support needs a bucket policy/configuration change.

Sports-card market values can be entered manually. Automatic sports-card pricing is not enabled because a provider with commercial display rights has not been selected.
