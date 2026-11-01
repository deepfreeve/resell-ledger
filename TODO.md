# CACHE backlog

Status reflects the current repository. A checkmark means the feature is implemented in the app; server-backed features may still need Cloudflare credentials before use.

## Implemented in this working copy

- [x] Photo capture, device file selection, browser image search, preview, private per-user Supabase Storage, thumbnail retrieval, clear retry errors.
- [x] Import eBay Listings Sales and supported sales CSVs with duplicate review, backdated sale dates when present, bought-cost estimates or edits, and per-sale reinvestment split.
- [x] Restore/export backups and CSV sales exports; backup now includes item, draft, and document photos.
- [x] Account management, data reset, password recovery, cloud sync status/retry, and user-isolated Supabase data.
- [x] Sale allocation returns inventory cost, fees, and shipping to reinvestment first, then applies the per-sale slider to remaining profit; same slider is available when recording a sale and marking its payout paid.
- [x] Inventory source, storage location, owned/consigned tracking, consignment settlement balances, package dimensions, and SKU barcode scanning where supported by the browser/device.
- [x] Sourcing log and buy-plan calculator.
- [x] Selective deal-search rules, private saved searches, active eBay Browse search route, current listing cards, and conservative scoring only when the user's verified/manual sold comps are sufficient and closely matched.
- [x] Manual price-comparison records; CACHE does not claim restricted eBay sold-comparable access.
- [x] AI photo batch draft review/edit, split/combine, and conversion into inventory only after the user enters actual purchase cost and date.
- [x] Listing readiness review that flags drafts missing photos, title, condition, or a listed price before seller review.
- [x] Fee, shipping, break-even, target-price estimator; weekly/monthly net-profit goals.
- [x] Offer floor helper that compares an entered offer against break-even and target-profit prices.
- [x] Grading submission tracker with grading/shipping expenses added to item cost basis.
- [x] Shipping desk, multi-item sale allocation, refund/return records, mixed-lot cost allocation, consignment balances, and configurable stale-inventory review list.
- [x] Private image document attachments to inventory items.
- [x] Responsive layouts for the added workspace tools, with a mobile Tools menu for Sourcing & deals, Listing drafts, Business tools, and Your account; mobile search is available from the header.

## Finish after required account setup or design decisions

- [x] Add the CACHE box logo as the iPhone/iPad home-screen bookmark icon, browser favicon, and Android PWA install icon/manifest.
- [ ] Prepare native iOS/Android releases, in-app account deletion and public deletion URL, privacy/support materials, store disclosures/listings, signing, and device testing. Track prerequisites in [APP_STORE_READINESS.md](APP_STORE_READINESS.md); store enrollment and legal/support details require the owner.
- [~] **Inventory market values:** Added market value fields, manual value entry, inventory total and known-cost gain summary, exact card metadata, and a JustTCG search route that requires the user to select a card and matching variant. Still needs the user's Cloudflare JustTCG secret, paid commercial plan before public/commercial display, live API verification, and a licensed sports-card provider. Graded prices use JustTCG's beta endpoint and may lack coverage.
- [ ] Set Cloudflare Pages variables/secrets for optional AI, eBay Browse, and JustTCG endpoints; apply request rate limits before enabling paid AI and card-price lookups. Use a JustTCG paid commercial plan before public/commercial use. See README.md.
- [ ] Verify the latest mobile navigation changes on the live Cloudflare deployment.
- [ ] Configure a custom domain and add it to Supabase Auth's allowed redirect URLs.
- [ ] Add sample eBay refund/partial-refund and additional report formats, then extend the CSV parser and preview.
- [ ] Implement secure eBay seller OAuth and reviewed batch publishing after configuring developer credentials, production access, token storage, and seller fulfillment/return/payment policies. Never store the seller password or expose client secrets in browser code.
- [ ] Add marketplace draft/readiness requirements and per-item publish result/retry flow together with the seller OAuth publishing work.
- [ ] Add order/payout matching for reports that include stable transaction or payout identifiers; keep buyer data to the minimum needed.
- [ ] Support PDF receipts/documents after updating the private Supabase Storage bucket's allowed MIME types and verifying its policies. Current upload supports images.
- [ ] Consider persistent photo editing, cross-listing status sync, scheduled repricing, and a fuller shipping-label integration after the underlying APIs are selected.

## Pro features to validate

- [ ] AI batch listing credits and reusable templates, with a small free allowance and per-account limits.
- [ ] Pricing research from a permitted sold-comparable source, with match confidence, comp count, source, and data freshness visible.
- [ ] Cross-listing workspace and marketplace status synchronization.
- [ ] Batch price/category edits, printable SKU labels, and duplicate listing batches.
- [ ] Photo batch editing, background cleanup, and consistent listing images.
- [ ] Inventory aging, sell-through, ROI, and richer platform/category reports.
- [ ] Tax-preparation exports with clear review notes and no tax-filing claims.
- [ ] Team seats, activity history, automations, and selective alerts.
- [ ] Higher inventory, private photo storage, and AI listing allowances.

## Pro billing foundation

- [ ] Choose a billing provider and define free/Pro limits and prices.
- [ ] Add server-verified billing webhooks and entitlement checks; do not trust a browser-only Pro flag.
- [ ] Define grace periods and upgrade messaging before gating features.
- [ ] Keep sign-in, privacy, data access, account deletion, and full export available to every account.
