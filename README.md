ResellLedger
A responsive resale inventory and profit tracker for Pokémon cards, sports cards, electronics, video games, clothing, collectibles, and other products.
Features
Dark, mobile-friendly dashboard
Track individual inventory items and purchase costs
Categorize products and record their condition
Search online for item photos, then browse or take private item photos and store notes
Record sale prices, platform fees, shipping, and other sale expenses
Read sale screenshots locally to prefill recognized sale details
Calculate net proceeds and estimated profit or loss
Track pending payouts separately from paid sales
Record recovered capital and split positive profit equally between reinvestment and personal funds
View completed sales and lifetime profit
Review monthly and category profit reports, export sales CSVs, and back up or restore account data
Import eBay orders/sales CSVs and Listings Sales reports with preview and duplicate checks; summary reports use the report end date because they omit individual sale dates
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
