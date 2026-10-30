# CACHE backlog

## Remaining setup and product work

- [ ] Review and approve the current changes before publishing; then confirm the Cloudflare Pages build and live site.
- [ ] Choose a custom domain and add it to Cloudflare Pages and Supabase Auth's allowed redirect URLs.
- [ ] Add CSV coverage for more eBay report variants, including refunds and partial refunds, once sample files are available.
- [ ] Build an optional eBay connection and reviewed batch publishing flow. Requires an eBay Developer keyset, OAuth redirect configuration, seller authorization, and policy/location setup. Never put the eBay client secret in browser code.
- [ ] Build AI batch listing drafts after choosing an AI provider, adding a server-side API secret, and reviewing per-listing operating costs. Keep drafts private and unpublished until explicit user approval.
- [ ] Add barcode/SKU scanning for phone-based inventory entry.

## Pro feature ideas to validate

- [ ] AI batch listing creation and reusable listing templates.
- [ ] Pricing research using a permitted marketplace data source.
- [ ] Cross-listing workspace and marketplace status sync.
- [ ] Batch price/category edits, duplicate batches, and printable SKU labels.
- [ ] Photo batch editing, background cleanup, and consistent listing images.
- [ ] Inventory aging, sell-through, ROI, and richer platform/category reports.
- [ ] Tax-preparation exports with clear review notes and no tax-filing claims.
- [ ] Team seats, activity history, automation, and alerts.
- [ ] Higher usage allowances for inventory, photo storage, and AI listing credits.

## Pro plan foundations

- [ ] Compare billing providers and decide how subscription status is validated securely.
- [ ] Add server-side billing webhooks and entitlement checks; never trust a browser-only Pro flag.
- [ ] Define free and Pro limits, interruption grace periods, and upgrade messaging before gating features.
- [ ] Keep sign-in, privacy, data access, account deletion, and complete export available to every account.
