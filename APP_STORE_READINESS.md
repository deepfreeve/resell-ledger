# CACHE app store readiness

## Ready in this repository

- CACHE has a branded bookmark icon for iPhone/iPad home screens and a web app manifest with the Android install icon sizes.
- The existing site supports signed-in accounts, private per-user data and photos, password recovery, data export/backup, and account-data reset.
- The web app is hosted over HTTPS on the CACHE domain.

## Required work before store submission

1. **Build native iOS and Android apps.** The current project is a Cloudflare Pages website/PWA, not a signed native store package. A native shell such as Capacitor can reuse the web app, but it needs real device integration and review. Apple may reject a website wrapper that does not provide enough app-specific value. Add/test native photo capture and file picking, camera permissions, deep links for sign-in and password recovery, keyboard/safe-area behavior, and reliable session restoration.
2. **Add in-app account deletion.** CACHE currently lets users reset their records or sign out, but does not delete the Supabase Auth account. Implement deletion through a server-side Supabase Edge Function that verifies the signed-in user, removes their private storage objects and data, and then deletes the Auth user. Keep any service-role key on the server only. Add a public account-deletion URL for Google Play and make the in-app path easy to find.
3. **Prepare privacy and support materials.** Publish a privacy policy and terms that accurately describe authentication, synced inventory/sales, and private uploaded photos. Set a monitored support contact, and make support/privacy links available in the app and store listings. Complete Apple privacy disclosures and Google Play Data safety disclosures from the actual data flows.
4. **Prepare store records.** Choose the final app name, subtitle/short description, full descriptions, category, age/content ratings, countries, pricing, screenshots, and promotional artwork. Provide App Review with a working demo account or a review path that explains account creation and email confirmation.
5. **Set up accounts and signing.** Enroll in Apple Developer Program and Google Play Console; complete legal identity, tax/payment, and business details; configure bundle/package IDs, signing certificates/keys, and release tracks. These require the owner's store accounts and cannot be completed from this repository.
6. **Build and test release candidates.** iOS builds and submission require macOS with Xcode. Android requires Android Studio and the Android SDK. Test on real phones and tablets, including install/update, sign-in/recovery links, photos, backup/restore, slow/offline connections, and data deletion. Meet the Play target API requirement in effect at submission time.
7. **Check service and licensing readiness.** Confirm production Supabase Auth redirect URLs and email templates, Cloudflare environment settings, privacy/storage retention, and any third-party API terms. Do not enable paid APIs or claim market-price coverage beyond the provider's license and data.

## Official references

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple account deletion requirement](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Google Play user data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Capacitor getting started](https://capacitorjs.com/docs/getting-started)
- [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)

This checklist is a preparation guide, not a guarantee of store approval. Store policies and target API levels can change; recheck the linked requirements when submitting.
