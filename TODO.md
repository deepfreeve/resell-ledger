# TODO

## Photos

- [x] Resize and compress item photos before saving them in account data.
- [x] Move item photos to a private Supabase Storage bucket with per-user access rules.
- [x] Automatically migrate older embedded photos after sign-in.
- [x] Let users choose a photo from their device or open the camera from the item form.
- [x] Search online for item photos, then download and attach the chosen image.

## Account and sales imports

- [x] Add a Your account page under Management.
- [x] Import eBay sales CSVs with a review step, duplicate checks, and SKU/title inventory matching.
- [x] Keep unmatched imported sales out of profit totals until their purchase cost is added.

## Future improvements

- [x] Add local sale screenshot OCR to prefill sale details.
- [x] Add sales CSV export and JSON backup/restore, including photos.
- [x] Add monthly and category profit reports.
- [x] Verify JavaScript syntax, CSV parsing/import behavior, OCR field parsing, and Supabase Storage policies.
- [ ] Run a browser UI smoke test. Blocked in this environment: the local preview server cannot bind a socket, and the browser blocks local file URLs. Revisit when a browser-accessible preview is available.
