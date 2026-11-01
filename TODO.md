# CACHE backlog

Status reflects the current repository. A checkmark means the feature is implemented in the app; server-backed features may still need Cloudflare credentials before use.

## Implemented in this working copy

- [x] Photo capture, device file selection, browser image search, preview, private per-user Supabase Storage, thumbnail retrieval, clear retry errors.
- [x] Import eBay Listings Sales and supported sales CSVs with duplicate review, backdated sale dates when present, bought-cost estimates or edits, and per-sale reinvestment split.
- [x] Import eBay All active listings CSV reports into inventory with duplicate checks, available-quantity expansion, USD validation, and adjustable bought-cost estimates as a percent of listed price.
- [x] Restore/export backups and CSV sales exports; backup now includes item, draft, and document photos.
- [x] Account management, data reset, password recovery, cloud sync status/retry, and user-isolated Supabase data.
- [x] Sale allocation returns inventory cost, fees, and shipping to reinvestment first, then applies the per-sale slider to remaining profit; same slider is available when recording a sale and marking its payout paid.
- [x] Inventory source, storage location, owned/consigned tracking, consignment settlement balances, package dimensions, and SKU barcode scanning where supported by the browser/device.
- [x] Sourcing log and buy-plan calculator.
- [x] eBay active-listing deal search in easy and advanced modes; saved advanced searches, condition/cost filters, and estimated profit using recorded sales and manual comparisons.
- [x] Keep the basic deal finder quick (product, condition, maximum all-in cost); expose profit, ROI, comparable-count, shipping, and fee controls in Advanced mode.
- [x] Remove the Listing Drafts workspace because it did not publish or bulk-list items to eBay. Existing saved draft data remains preserved in account backups.
- [x] Manual inventory value estimates and sold-price references; the eBay deal finder compares current active listings with these user-owned references and CACHE sales.
- [x] Manual price-comparison records; CACHE does not claim restricted eBay sold-comparable access.
- [x] Fee, shipping, break-even, target-price estimator; weekly/monthly net-profit goals.
- [x] Offer floor helper that compares an entered offer against break-even and target-profit prices.
- [x] Grading submission tracker with grading/shipping expenses added to item cost basis.
- [x] Shipping desk, multi-item sale allocation, refund/return records, mixed-lot cost allocation, consignment balances, and configurable stale-inventory review list.
- [x] Private image document attachments to inventory items.
- [x] Responsive layouts for the added workspace tools, with a mobile Tools menu for Sourcing, Business tools, and Your account; mobile search is available from the header.

## Finish after required account setup or design decisions

- [x] Add the CACHE box logo as the iPhone/iPad home-screen bookmark icon, browser favicon, and Android PWA install icon/manifest.
- [x] Add in-app account deletion and a public account-deletion page, backed by the deployed JWT-verified Supabase function. Recheck the flow with a disposable account before store release.
- [x] Add Capacitor native configuration, pinned platform/CLI dependencies, scripts, and authenticated API support for native origins. Native projects, deep links, native review polish, signing, and device testing remain.
- [ ] Prepare final privacy/support pages and disclosures, store artwork, signing, and device testing. Track prerequisites in [APP_STORE_READINESS.md](APP_STORE_READINESS.md); store enrollment and legal/support details require the owner.
- [x] Manual inventory value entry and saved value history.
- [ ] Set Cloudflare Pages variables/secrets for the eBay Browse deal-search route and obtain eBay Buy API production approval. See README.md.
- [ ] Verify the latest mobile navigation changes on the live Cloudflare deployment.
- [ ] Configure a custom domain and add it to Supabase Auth's allowed redirect URLs.
- [ ] Add sample eBay refund/partial-refund and additional report formats, then extend the CSV parser and preview.
- [ ] Implement secure eBay seller OAuth and reviewed batch publishing after configuring developer credentials, production access, token storage, and seller fulfillment/return/payment policies. Never store the seller password or expose client secrets in browser code.
- [ ] Add order/payout matching for reports that include stable transaction or payout identifiers; keep buyer data to the minimum needed.
- [ ] Support PDF receipts/documents after updating the private Supabase Storage bucket's allowed MIME types and verifying its policies. Current upload supports images.
- [ ] Consider persistent photo editing, cross-listing status sync, scheduled repricing, and a fuller shipping-label integration after the underlying APIs are selected.

## Pro features to validate

- [ ] Add optional current-market value pricing from permitted sources, with match confidence, source, and data freshness visible; keep manual values available if feeds are unavailable. The eBay active-listing deal finder is implemented separately and awaits API configuration/approval above.
- [ ] Cross-listing workspace and marketplace status synchronization.
- [ ] Batch price/category edits, printable SKU labels, and duplicate listing batches.
- [ ] Photo batch editing, background cleanup, and consistent listing images.
- [ ] Inventory aging, sell-through, ROI, and richer platform/category reports.
- [ ] Tax-preparation exports with clear review notes and no tax-filing claims.
- [ ] Team seats, activity history, automations, and selective alerts.
- [ ] Higher inventory and private photo storage allowances.

## Pro billing foundation

- [ ] Choose a billing provider and define free/Pro limits and prices.
- [ ] Add server-verified billing webhooks and entitlement checks; do not trust a browser-only Pro flag.
- [ ] Define grace periods and upgrade messaging before gating features.
- [ ] Keep sign-in, privacy, data access, account deletion, and full export available to every account.
