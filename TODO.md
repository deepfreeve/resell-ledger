# CACHE backlog

## Next up

- [ ] Confirm the latest Cloudflare Pages deployment succeeds and opens correctly.
- [ ] Run a browser smoke test for sign-in, adding/editing items, photo upload, sale entry, eBay CSV import, backup restore, and account reset. Use a test account for destructive flows.
- [ ] Add a “Download backup first” option to the account reset confirmation.
- [ ] Expand eBay CSV handling for additional report formats, refunds, and partial refunds; document how each amount affects revenue and fees.
- [ ] Add a custom domain in Cloudflare Pages and update Supabase Auth redirect URLs after choosing the domain.
- [ ] Add barcode/SKU scanning for faster item lookup and entry on phones.

## Pro feature candidates

Prioritize paid features that save time, improve pricing decisions, or support a growing resale business. Keep sign-in, privacy, data access, and basic backup/export available to every account.

- [ ] **AI listing assistant:** Turn item details and photos into marketplace-ready titles, descriptions, and keywords; let users choose tone and platform.
- [ ] **Pricing research:** Show sold-price comparisons, recent price ranges, and suggested listing prices from an approved marketplace data source.
- [ ] **Cross-listing workspace:** Prepare listings for multiple marketplaces, track where each item is listed, and warn about stale or duplicate listings.
- [ ] **Marketplace sync:** Connect supported marketplace accounts to import sales and update listing status when an item sells.
- [ ] **Batch operations:** Edit prices and categories in bulk, duplicate batches, and create printable SKU/barcode labels.
- [ ] **Photo studio:** Batch crop and resize photos, remove backgrounds, and produce consistent listing images.
- [ ] **Advanced analytics:** Break down margins by platform, product, category, and time; add inventory aging, sell-through, and return-on-investment views.
- [ ] **Tax-ready reports:** Organize sales, fees, shipping, and cost records into exportable summaries, with clear review notes and no tax-filing claims.
- [ ] **Team accounts:** Share inventory with staff or business partners using roles, activity history, and change tracking.
- [ ] **Automation and alerts:** Flag slow-moving items, unusually low margins, missing purchase costs, and payouts that appear overdue.
- [ ] **Higher-volume tools:** Support larger inventories, more photo storage, and longer report history with transparent plan limits.

## Pro plan foundations

- [ ] Pick a billing provider and decide how subscription status will be stored and checked securely.
- [ ] Add a server-side endpoint for billing webhooks and entitlement checks; do not trust a browser-only Pro flag.
- [ ] Define Free and Pro limits before building gated features, and provide a grace period for billing interruptions.
- [ ] Keep user data, account deletion, and at least one complete data export available without a paid subscription.
