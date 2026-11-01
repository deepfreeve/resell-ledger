# CACHE Privacy Policy — owner review required

**Draft only. Do not publish until every bracketed field is completed and the owner has verified every service and retention statement.** This is a working product-data summary, not legal advice.

- **Operator/legal business name:** [ADD LEGAL NAME]
- **Effective date:** [ADD DATE]
- **Privacy/support contact:** [ADD A MONITORED EMAIL OR CONTACT URL]
- **Business address/jurisdiction, if required:** [ADD DETAILS]
- **Retention and provider-backup schedule:** [VERIFY AND ADD]

## Information CACHE handles

When you create an account, CACHE processes your email address and authentication/session information through Supabase Auth. CACHE does not receive or store your account password in its application database.

If you use CACHE, the information you enter may include product names, categories, purchase costs and dates, sale prices and dates, marketplace fees, shipping costs, notes, balances, imported sales rows, and private product or receipt images. These records sync to your CACHE account in Supabase. CACHE also keeps an account-specific copy in the browser's local storage for resilience. Anyone with access to an unlocked browser profile may be able to access that local copy.

Image OCR for sale screenshots runs in your browser. When you request AI listing suggestions and AI generation is enabled, the selected product photos and text you provide for that request are sent to the configured AI provider (currently OpenAI). When you request active eBay listing search, your search terms are sent to eBay through CACHE's server. When you request card market lookup, the card details you submit are sent to the configured pricing provider (currently JustTCG). These optional services are only used when their feature is enabled and you choose to use it. Their own privacy and retention terms also apply.

When you import an eBay CSV, CACHE parses it in your browser. Imported rows are saved to your account only when you confirm the import. CACHE's import flow is designed to ignore buyer details. Backups and exports are generated for you to download; those downloaded files are under your control.

## Providers and purposes

- **Supabase:** account sign-in, cloud database, and private photo/document storage.
- **Cloudflare:** website hosting and server-side feature requests.
- **jsDelivr:** delivery of third-party browser libraries currently referenced by the site.
- **OpenAI, eBay, and JustTCG:** optional features described above, only when configured and used.

The services may process technical information such as IP address, browser/device details, request time, and security logs to provide, secure, and troubleshoot their services. Review each provider's current privacy terms before publishing this policy.

## Access, security, and deletion

Account records are scoped to the signed-in user using Supabase Row Level Security. Product images are stored in a private bucket with per-user access rules and are displayed using temporary signed links. No online service can guarantee absolute security.

You can export your records from CACHE and request permanent deletion in the account settings or at [https://usecache.org/delete-account.html](https://usecache.org/delete-account.html). Deletion removes the Supabase Auth account, its CACHE data row, and stored objects in the CACHE photo bucket. Copies may remain temporarily in provider backup or security systems according to their retention schedules; the owner must confirm those periods before publication.

## Owner decisions before publication

Confirm the legal operator, a monitored privacy/support contact, applicable privacy rights and request process, age/audience policy, data retention and backup periods, provider subprocessors/regions, all enabled feature providers, and any legal retention exceptions. Complete Apple and Google disclosures to match the release build. Do not claim data is never shared, never retained, or immediately erased from all backups unless that has been verified.
