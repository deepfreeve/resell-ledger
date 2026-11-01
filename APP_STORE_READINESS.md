# CACHE app store readiness

## Ready in this repository

- CACHE has a branded bookmark icon for iPhone/iPad home screens and a web app manifest with the Android install icon sizes.
- The existing site supports signed-in accounts, private per-user data and photos, password recovery, data export/backup, and account-data reset.
- Added in-app and public account-deletion flows. They re-confirm the user's password, remove private photos and local CACHE copies, and delete the Supabase Auth account through a JWT-verified Edge Function. The function is deployed to the connected Supabase project; use the instructions in [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for future clones or redeployments.
- Added Capacitor 8.6.0 configuration, iOS/Android dependencies, native CLI scripts, and authenticated API CORS support for native origins. Platform projects still need to be generated and tested.
- Draft store copy and a privacy-policy working draft are in `STORE_LISTING_DRAFT.md` and `PRIVACY_POLICY_DRAFT.md`. They are not final publication documents until the owner fills in the marked business, support, jurisdiction, and retention details.
- The web app is hosted over HTTPS on the CACHE domain.

## Required work before store submission

1. **Build native iOS and Android apps.** `capacitor.config.ts` uses `public/` as the web assets and `org.usecache.cache` as a proposed permanent app ID. Confirm the app ID before store publication. After installing dependencies, generate projects with `pnpm native:add:android` and (on a Mac) `pnpm native:add:ios`. Finish and test sign-up/password-recovery deep links, camera and file selection, keyboard/safe-area behavior, and session restoration. Review external browser libraries and add enough native app-specific value for Apple's minimum-functionality review; a thin website wrapper may be rejected.
2. **Finish privacy and support materials.** Review and publish the privacy policy and terms. Set a monitored support contact, and add final privacy/support links to the app and store listings. Complete Apple privacy disclosures and Google Play Data safety disclosures using the actual release build and enabled services.
3. **Prepare store records.** Confirm the final app name, short/full descriptions, category, age/content ratings, countries, pricing, screenshots, and promotional artwork. Draft copy is in `STORE_LISTING_DRAFT.md`. Provide App Review with a working demo account or a review path that explains account creation and email confirmation.
4. **Set up accounts and signing.** Enroll in Apple Developer Program and Google Play Console; complete legal identity, tax/payment, and business details; configure final bundle/package IDs, signing certificates/keys, and release tracks. These require the owner's store accounts and cannot be completed from this repository.
5. **Build and test release candidates.** iOS builds and submission require macOS with Xcode. Android requires Android Studio and the Android SDK. Capacitor 8 targets Android 16 (API 36); Google Play currently requires API 36 for new apps and updates starting August 31, 2026. Test on real phones and tablets, including install/update, sign-in/recovery links, photos, backup/restore, slow/offline connections, and data deletion.
6. **Check service and licensing readiness.** Confirm production Supabase Auth redirect URLs and email templates, Cloudflare environment settings, privacy/storage retention, and any third-party API terms. Do not enable paid APIs or claim market-price coverage beyond the provider's license and data.

## Official references

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple account deletion requirement](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Google Play user data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Capacitor getting started](https://capacitorjs.com/docs/getting-started)
- [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)

This checklist is a preparation guide, not a guarantee of store approval. Store policies and target API levels can change; recheck the linked requirements when submitting.
