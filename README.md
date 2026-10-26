ResellLedger

A responsive resale inventory and profit tracker for Pokémon cards, sports cards, electronics, video games, clothing, collectibles, and other products.

Features

* Dark, mobile-friendly dashboard
* Track individual inventory items and purchase costs
* Categorize products and record their condition
* Store optional item photos and notes
* Record sale prices, platform fees, shipping, and other sale expenses
* Calculate net proceeds and estimated profit or loss
* Track pending payouts separately from paid sales
* Record recovered capital and split positive profit equally between reinvestment and personal funds
* View completed sales and lifetime profit
* Search and filter available inventory
* Duplicate item details when purchasing multiple copies

Project files

* index.html — application structure
* style.css — responsive styling
* app.js — inventory, sales, and financial calculations

Run locally

Open index.html in a modern browser, or serve the project using a local development server.

Publish with Cloudflare Pages

1. Push the project files to a GitHub repository.
2. Open the Cloudflare dashboard.
3. Navigate to Workers & Pages.
4. Create a Pages project and connect the GitHub repository.
5. For this plain HTML, CSS, and JavaScript project, leave the build command empty.
6. Set the build output directory to / if Cloudflare offers that setting for your deployment.
7. Deploy the project and open the generated pages.dev address.

Data and privacy

This starter version stores inventory and sales in the browser’s localStorage.

* Data is not synchronized between devices.
* Clearing browser data can erase the stored records.
* Photos consume browser storage.
* There is no login or cloud database yet.
* Do not use this prototype as the only copy of important financial records.

Current limitations

* Sale screenshots are not automatically processed with OCR.
* Supabase authentication and cloud synchronization are not implemented.
* The application needs browser testing before being relied on for real inventory or accounting.

Future development

Potential next steps include Supabase authentication, cloud synchronization, sale screenshot OCR, data export and backup, and additional financial reporting.
