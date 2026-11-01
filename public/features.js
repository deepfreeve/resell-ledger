"use strict";

/* CACHE reseller workspace features. Data stays inside the signed-in user's existing RLS-protected payload. */

const CACHE_API_ORIGIN = window.CACHE_API_ORIGIN || window.location.origin;
const cacheApiUrl = (path) => new URL(path, CACHE_API_ORIGIN).toString();

function featureId() { return makeId(); }
function featureDate() { return todayString(); }
function featureFormData(form) { return Object.fromEntries(new FormData(form).entries()); }
function featureToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 4500);
}
function featurePersist() {
  if (!saveData()) throw new Error("Sign in before saving this change.");
  renderWorkspace();
  renderAll();
}
function featureNum(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function featureRound(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
function featureEsc(value) { return escapeHtml(value ?? ""); }
function featureTodayMonth() { return todayString().slice(0, 7); }
function featureDateRange(period) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  if (period === "week") {
    const day = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - day);
  }
  const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(today) };
}
function featureItemName(itemId) { return data.items.find((item) => item.id === itemId)?.name || "Inventory item"; }
function featurePaidSales() { return data.sales.filter((sale) => sale.status === "paid"); }
function featurePercent(value) { return `${featureRound(value)}%`; }

function normalizeFeatureKey(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function featurePriceComparables(search) {
  const key = normalizeFeatureKey(search.query);
  const condition = normalizeFeatureKey(search.condition || "any");
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 365);
  const comps = data.priceComps
    .filter((comp) => normalizeFeatureKey(comp.product) === key)
    .filter((comp) => condition === "any" || normalizeFeatureKey(comp.condition) === condition)
    .filter((comp) => !comp.soldDate || new Date(`${comp.soldDate}T00:00:00`) >= recentDate)
    .map((comp) => ({ price: featureNum(comp.price), date: comp.soldDate || "", condition: comp.condition, source: comp.source || "Manual comp" }));
  for (const sale of featurePaidSales()) {
    const item = data.items.find((entry) => entry.id === sale.itemId);
    if (!item || item.purchaseCostEstimated || item.purchaseCostUnknown) continue;
    const saleKey = normalizeFeatureKey(item.marketComparableKey || item.name);
    if (saleKey !== key) continue;
    if (condition !== "any" && normalizeFeatureKey(item.itemCondition) !== condition) continue;
    if (sale.saleDate && new Date(`${sale.saleDate}T00:00:00`) < recentDate) continue;
    comps.push({ price: featureNum(sale.salePrice), date: sale.saleDate || "", condition: item.itemCondition || "Not specified", source: sale.source === "ebay" ? "Imported eBay sale" : "CACHE sale" });
  }
  return comps.filter((comp) => comp.price > 0);
}

function assessPossibleDeal(listing, search) {
  const comps = featurePriceComparables(search).map((entry) => entry.price).sort((a, b) => a - b);
  const median = comps.length ? comps[Math.floor((comps.length - 1) / 2)] : 0;
  const price = featureNum(listing.price);
  const shipping = featureNum(listing.shipping);
  const allIn = featureRound(price + shipping);
  const feePercent = featureNum(search.feePercent ?? data.settings.defaultFeePercent);
  const outbound = featureNum(data.settings.defaultOutgoingShipping);
  const expectedNet = featureRound(median - median * feePercent / 100 - outbound);
  const profit = featureRound(expectedNet - allIn);
  const roi = allIn > 0 ? featureRound(profit / allIn * 100) : 0;
  const minimumComps = Math.max(1, featureNum(search.minimumComps) || 3);
  const conditionMatch = search.condition === "any" || normalizeFeatureKey(search.condition) === normalizeFeatureKey(listing.condition || "");
  const terms = normalizeFeatureKey(search.query).split(" ").filter((word) => word.length > 1);
  const title = normalizeFeatureKey(listing.title);
  const matchedWords = terms.filter((word) => title.includes(word)).length;
  const matchRatio = terms.length ? matchedWords / terms.length : 0;
  const matchConfidence = conditionMatch && matchRatio >= 0.9 ? "Strong title/condition match" : (matchRatio >= 0.6 ? "Review title and condition" : "Weak product match");
  const good = comps.length >= minimumComps && conditionMatch && matchRatio >= 0.9 && allIn <= featureNum(search.maxCost) && shipping <= featureNum(search.maxShipping) && profit >= featureNum(search.minProfit) && roi >= featureNum(search.minRoi);
  return { comps: comps.length, median, allIn, expectedNet, profit, roi, conditionMatch, matchConfidence, good, comparableCount: comps.length };
}

function renderDealSearches() {
  const container = $("#dealSearchList");
  if (!container) return;
  container.innerHTML = data.dealSearches.length ? data.dealSearches.map((search) => {
    const comps = featurePriceComparables(search);
    const median = comps.map((comp) => comp.price).sort((a, b) => a - b)[Math.floor((comps.length - 1) / 2)] || 0;
    return `<article class="feature-row"><div><strong>${featureEsc(search.query)}</strong><p>${featureEsc(search.condition)} · max all-in ${money(search.maxCost)} · min profit ${money(search.minProfit)} · ${comps.length} matching comps${comps.length ? ` · median ${money(median)}` : ""}</p><small>${search.active === false ? "Paused" : "Watching while CACHE is open"}${search.lastCheckedAt ? ` · checked ${featureEsc(formatDate(search.lastCheckedAt.slice(0, 10)))}` : ""}</small></div><div class="feature-row-actions"><button class="secondary-button" type="button" data-run-deal="${featureEsc(search.id)}">Search eBay</button><button class="secondary-button" type="button" data-pause-deal="${featureEsc(search.id)}">${search.active === false ? "Resume" : "Pause"}</button><button class="danger-button" type="button" data-delete-deal="${featureEsc(search.id)}">Delete</button></div></article>`;
  }).join("") : '<p class="muted-text">Save a search to start building a selective deal watchlist.</p>';
}

function renderDealResults(listings = [], search = null, note = "") {
  const container = $("#dealResults");
  if (!container) return;
  if (!listings.length) {
    container.innerHTML = note ? `<p class="field-hint">${featureEsc(note)}</p>` : "";
    return;
  }
  const scored = listings.map((listing) => ({ listing, assessment: assessPossibleDeal(listing, search || {}) }));
  const reliable = scored.filter(({ assessment }) => assessment.comps >= Math.max(1, featureNum(search?.minimumComps) || 3));
  const good = reliable.filter(({ assessment }) => assessment.good);
  const weak = scored.filter(({ assessment }) => assessment.comps < Math.max(1, featureNum(search?.minimumComps) || 3));
  container.innerHTML = `${note ? `<p class="field-hint">${featureEsc(note)}</p>` : ""}${good.length ? `<h3>Possible deals that match your rules</h3>` : ""}${scored.map(({ listing, assessment }) => `<article class="deal-card ${assessment.good ? "deal-card-match" : ""}">${listing.imageUrl ? `<img src="${featureEsc(listing.imageUrl)}" alt="" loading="lazy">` : ""}<div class="deal-card-main"><strong>${featureEsc(listing.title)}</strong><span>${featureEsc(listing.condition || "Condition not listed")} · ${money(listing.price)} + ${money(listing.shipping)} shipping</span><span>${assessment.comps >= (featureNum(search?.minimumComps) || 3) ? `${assessment.good ? "Possible deal" : "Does not meet your rules"} · est. profit ${money(assessment.profit)} · ROI ${featurePercent(assessment.roi)}` : "Not scored: not enough matching sold comparisons"}</span><small>${assessment.comparableCount} comps · ${featureEsc(assessment.matchConfidence)} · comps from the last 12 months</small><a class="secondary-button" href="${featureEsc(listing.url)}" target="_blank" rel="noopener noreferrer">Review on eBay</a></div></article>`).join("")}${weak.length ? `<p class="field-hint">${weak.length} listing(s) have too few comparable sales to score. CACHE will not flag those as deals.</p>` : ""}`;
  if (good.length && search?.alertsEnabled && "Notification" in window && Notification.permission === "granted") {
    const ids = new Set(search.alertedListingIds || []);
    for (const { listing } of good) {
      if (ids.has(listing.id)) continue;
      new Notification("Possible CACHE deal", { body: `${listing.title} · ${money(listing.price + listing.shipping)} all-in` });
      ids.add(listing.id);
    }
    search.alertedListingIds = [...ids].slice(-200);
    search.lastAlertAt = new Date().toISOString();
    saveData();
  }
}

async function runDealSearch(searchId) {
  const search = data.dealSearches.find((entry) => entry.id === searchId);
  if (!search) return;
  const results = $("#dealResults");
  results.innerHTML = '<p class="field-hint">Checking current eBay listings…</p>';
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const response = await fetch(cacheApiUrl("/api/deal-search"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
      body: JSON.stringify({ query: search.query, condition: search.condition, marketplace: search.marketplace || "EBAY_US", limit: 40 })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "eBay search is not configured yet.");
    search.lastCheckedAt = new Date().toISOString();
    featurePersist();
    renderDealResults(payload.items || [], search, "Current listings are compared with this account's recorded sales and manual comps. eBay sold-price data is not included unless an approved source is configured.");
  } catch (error) {
    console.error("CACHE eBay deal search failed:", error);
    renderDealResults([], search, error.message || "Could not search eBay right now. Check the eBay setup and try again.");
  }
}

function renderSourcingLists() {
  renderDealSearches();
  const comps = $("#priceCompList");
  if (comps) comps.innerHTML = data.priceComps.length ? [...data.priceComps].sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || "")).map((comp) => `<article class="feature-row"><div><strong>${featureEsc(comp.product)}</strong><p>${featureEsc(comp.condition)} · ${money(comp.price)} · ${featureEsc(formatDate(comp.soldDate))} · ${featureEsc(comp.source || "Manual comp")}</p></div><button class="danger-button" type="button" data-delete-comp="${featureEsc(comp.id)}">Remove</button></article>`).join("") : '<p class="muted-text">Add verified sold comparisons to improve deal scoring.</p>';
  const sources = $("#sourceLogList");
  if (sources) sources.innerHTML = data.sourcingLog.length ? [...data.sourcingLog].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => {
    const linked = data.items.filter((item) => normalizeFeatureKey(item.purchaseSource) === normalizeFeatureKey(entry.source));
    const profit = data.sales.filter((sale) => sale.status === "paid" && linked.some((item) => item.id === sale.itemId)).reduce((sum, sale) => sum + (saleProfit(sale) || 0), 0);
    return `<article class="feature-row"><div><strong>${featureEsc(entry.source)}</strong><p>${featureEsc(formatDate(entry.date))} · ${entry.count} item(s) · spent ${money(featureNum(entry.cost) + featureNum(entry.extra))} · recorded profit ${money(profit)}</p></div><button class="danger-button" type="button" data-delete-source="${featureEsc(entry.id)}">Remove</button></article>`;
  }).join("") : '<p class="muted-text">Log purchases to compare sourcing sources over time.</p>';
  const plans = $("#buyPlanList");
  if (plans) plans.innerHTML = data.buyPlans.length ? data.buyPlans.map((plan) => {
    const allIn = featureNum(plan.buyPrice) + featureNum(plan.inbound);
    const net = featureNum(plan.resale) * (1 - featureNum(plan.feePercent) / 100) - featureNum(plan.outbound);
    const profit = featureRound(net - allIn);
    return `<article class="feature-row"><div><strong>${featureEsc(plan.name)}</strong><p>All-in ${money(allIn)} · expected net ${money(net)} · margin ${money(profit)}${allIn ? ` · ROI ${featurePercent(profit / allIn * 100)}` : ""}</p></div><button class="danger-button" type="button" data-delete-plan="${featureEsc(plan.id)}">Remove</button></article>`;
  }).join("") : '<p class="muted-text">Save a buy plan to compare estimated margin before purchasing.</p>';
}

function renderListingDrafts() {
  const container = $("#listingDraftList");
  if (!container) return;
  container.innerHTML = data.listingDrafts.length ? data.listingDrafts.map((draft) => {
    const missing = [];
    if (!(draft.photos || []).length) missing.push("photo");
    if (!String(draft.title || "").trim()) missing.push("title");
    if (!String(draft.condition || "").trim() || draft.condition === "Not specified") missing.push("condition");
    if (draft.listedPrice == null || !Number.isFinite(Number(draft.listedPrice)) || Number(draft.listedPrice) <= 0) missing.push("price");
    const readiness = missing.length ? `Needs review: ${missing.join(", ")}` : "Ready for seller review";
    return `<article class="draft-card" data-draft-card="${featureEsc(draft.id)}"><label class="draft-select"><input type="checkbox" data-select-draft="${featureEsc(draft.id)}"> Select to combine</label>${(draft.photos || []).slice(0, 4).map((photo) => photo.startsWith("data:") ? `<img src="${featureEsc(photo)}" alt="Product photo" loading="lazy">` : `<img data-photo-path="${featureEsc(photo)}" alt="Product photo" loading="lazy">`).join("")}<label class="field">Title<input data-draft-field="title" data-draft-id="${featureEsc(draft.id)}" maxlength="140" value="${featureEsc(draft.title)}"></label><div class="form-row"><label class="field">Category<select data-draft-field="category" data-draft-id="${featureEsc(draft.id)}">${Object.entries(CATEGORY_NAMES).map(([id, name]) => `<option value="${featureEsc(id)}" ${draft.category === id ? "selected" : ""}>${featureEsc(name)}</option>`).join("")}</select></label><label class="field">Condition<input data-draft-field="condition" data-draft-id="${featureEsc(draft.id)}" value="${featureEsc(draft.condition || "Not specified")}"></label></div><label class="field">Description<textarea data-draft-field="description" data-draft-id="${featureEsc(draft.id)}" rows="4" maxlength="4000">${featureEsc(draft.description || "")}</textarea></label><label class="field">Suggested listed price ($)<input data-draft-field="listedPrice" data-draft-id="${featureEsc(draft.id)}" type="number" min="0" step="0.01" value="${draft.listedPrice == null ? "" : featureEsc(draft.listedPrice)}"></label><p class="draft-readiness ${missing.length ? "needs-review" : "ready"}">${featureEsc(readiness)}</p><div class="draft-missing-fields"><strong>Required before inventory:</strong><label class="field">Actual bought cost ($)<input data-draft-purchase-cost="${featureEsc(draft.id)}" type="number" min="0" step="0.01" placeholder="Enter actual cost"></label><label class="field">Actual purchase date<input data-draft-purchase-date="${featureEsc(draft.id)}" type="date"></label><small>These values are never generated. Enter them when you know them.</small></div><div class="detail-actions"><button class="primary-button" type="button" data-draft-inventory="${featureEsc(draft.id)}" ${draft.inventoryItemId ? "disabled" : ""}>${draft.inventoryItemId ? "Added to inventory" : "Create inventory item"}</button><button class="secondary-button" type="button" data-split-draft="${featureEsc(draft.id)}" ${(draft.photos || []).length > 1 ? "" : "disabled"}>Split photos</button><button class="danger-button" type="button" data-delete-draft="${featureEsc(draft.id)}">Delete draft</button></div><p class="field-hint">Draft only. Publishing is unavailable until eBay app credentials and account connection are configured.</p></article>`;
  }).join("") : '<div class="empty-state"><h3>No listing drafts yet</h3><p>Upload product photos for AI suggestions or create a manual draft.</p></div>';
  hydratePhotos(container);
}

function renderBusinessTools() {
  const options = (items, labelFn, placeholder) => [`<option value="">${featureEsc(placeholder)}</option>`, ...items.map((item) => `<option value="${featureEsc(item.id)}">${featureEsc(labelFn(item))}</option>`)].join("");
  const unsold = data.items.filter((item) => !getSaleForItem(item.id));
  if ($("#gradingItemSelect")) $("#gradingItemSelect").innerHTML = options(unsold, (item) => item.name, "Choose an inventory item");
  const paidSales = featurePaidSales();
  const saleLabel = (sale) => `${featureItemName(sale.itemId)} · ${money(sale.salePrice)} · ${formatDate(sale.saleDate)}`;
  ["#shipmentSaleSelect", "#returnSaleSelect"].forEach((selector) => { if ($(selector)) $(selector).innerHTML = options(paidSales, saleLabel, "Choose a paid sale"); });
  const lotChoices = $("#lotItemChoices");
  if (lotChoices) lotChoices.innerHTML = unsold.length ? unsold.map((item) => `<label class="lot-item-choice"><input type="checkbox" name="itemIds" value="${featureEsc(item.id)}"><span>${featureEsc(item.name)}${item.sku ? ` · ${featureEsc(item.sku)}` : ""}</span><small>Listed ${money(item.listedPrice)} · bought ${item.purchaseCostUnknown ? "unknown" : money(itemCostBasis(item))}</small></label>`).join("") : '<p class="muted-text">Add inventory items first.</p>';
  const bundleChoices = $("#bundleItemChoices");
  if (bundleChoices) bundleChoices.innerHTML = unsold.length ? unsold.map((item) => `<label class="lot-item-choice"><input type="checkbox" name="itemIds" value="${featureEsc(item.id)}"><span>${featureEsc(item.name)}</span><small>${money(item.listedPrice)} · ${item.purchaseCostUnknown ? "cost unknown" : "cost " + money(itemCostBasis(item))}</small></label>`).join("") : '<p class="muted-text">No available inventory to bundle.</p>';
  if ($("#repricingDays")) $("#repricingDays").value = data.settings.repricingReviewDays || 30;
  renderGoals();
  renderGrading();
  renderShipments();
  renderReturns();
  renderLots();
  renderRepricing();
  renderConsignment();
  renderDocuments();
  updateFeeEstimator();
}

function renderGoals() {
  const container = $("#goalList");
  if (!container) return;
  container.innerHTML = data.goals.length ? data.goals.map((goal) => {
    const range = featureDateRange(goal.period);
    const profit = featurePaidSales().filter((sale) => sale.saleDate >= range.start && sale.saleDate <= range.end && saleProfit(sale) !== null).reduce((sum, sale) => sum + saleProfit(sale), 0);
    const target = featureNum(goal.target);
    const pct = target ? Math.max(0, Math.min(100, profit / target * 100)) : 0;
    return `<article class="goal-row"><div><strong>${featureEsc(goal.name)}</strong><p>${goal.period === "week" ? "This week" : "This month"} · ${money(profit)} of ${money(target)} · ${featurePercent(pct)}</p><div class="goal-meter"><span style="width:${pct}%"></span></div></div><button class="danger-button" type="button" data-delete-goal="${featureEsc(goal.id)}">Remove</button></article>`;
  }).join("") : '<p class="muted-text">Set a target and CACHE will track recorded net profit toward it.</p>';
}

function renderGrading() {
  const container = $("#gradingList");
  if (!container) return;
  container.innerHTML = data.gradingSubmissions.length ? [...data.gradingSubmissions].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => `<article class="feature-row"><div><strong>${featureEsc(featureItemName(entry.itemId))} · ${featureEsc(entry.company)}</strong><p>${featureEsc(entry.status)} · submitted ${featureEsc(formatDate(entry.date))} · cost ${money(featureNum(entry.fee) + featureNum(entry.shipping))} · estimated graded value ${entry.estimatedValue ? money(entry.estimatedValue) : "not set"}</p></div><select data-grading-status="${featureEsc(entry.id)}"><option ${entry.status === "Preparing" ? "selected" : ""}>Preparing</option><option ${entry.status === "Submitted" ? "selected" : ""}>Submitted</option><option ${entry.status === "In grading" ? "selected" : ""}>In grading</option><option ${entry.status === "Shipped back" ? "selected" : ""}>Shipped back</option><option ${entry.status === "Complete" ? "selected" : ""}>Complete</option></select><button class="danger-button" type="button" data-delete-grading="${featureEsc(entry.id)}">Remove</button></article>`).join("") : '<p class="muted-text">No grading submissions recorded.</p>';
}

function renderShipments() {
  const container = $("#shipmentList");
  if (!container) return;
  container.innerHTML = data.shipments.length ? data.shipments.map((shipment) => `<article class="feature-row"><div><strong>${featureEsc(featureItemName(data.sales.find((sale) => sale.id === shipment.saleId)?.itemId))}</strong><p>${featureEsc(shipment.carrier || "Carrier not set")} · ${featureEsc(shipment.tracking || "No tracking number")} · ship by ${featureEsc(shipment.shipBy ? formatDate(shipment.shipBy) : "not set")}</p></div><select data-shipment-status="${featureEsc(shipment.id)}"><option ${shipment.status === "Ready" ? "selected" : ""}>Ready</option><option ${shipment.status === "Label purchased" ? "selected" : ""}>Label purchased</option><option ${shipment.status === "Shipped" ? "selected" : ""}>Shipped</option><option ${shipment.status === "Delivered" ? "selected" : ""}>Delivered</option><option ${shipment.status === "Issue" ? "selected" : ""}>Issue</option></select></article>`).join("") : '<p class="muted-text">Add a paid sale to prepare a shipment.</p>';
}

function renderReturns() {
  const container = $("#returnList");
  if (!container) return;
  container.innerHTML = data.returnRecords.length ? [...data.returnRecords].sort((a, b) => b.date.localeCompare(a.date)).map((record) => `<article class="feature-row"><div><strong>${featureEsc(featureItemName(data.sales.find((sale) => sale.id === record.saleId)?.itemId))} · refund ${money(record.amount)}</strong><p>${featureEsc(formatDate(record.date))} · ${record.returned ? "item returned to inventory" : "item not returned"}${record.notes ? ` · ${featureEsc(record.notes)}` : ""}</p></div></article>`).join("") : '<p class="muted-text">No refunds or returns recorded.</p>';
}

function renderLots() {
  const container = $("#lotSplitList");
  if (!container) return;
  container.innerHTML = data.lotPurchases.length ? data.lotPurchases.map((lot) => `<article class="feature-row"><div><strong>${featureEsc(lot.name)}</strong><p>${money(lot.cost)} across ${(lot.allocations || []).length} item(s) · ${featureEsc(formatDate(lot.date))} · ${featureEsc(lot.method)}</p></div></article>`).join("") : '<p class="muted-text">No mixed-lot purchase allocations yet.</p>';
}

function renderRepricing() {
  const container = $("#repricingList");
  if (!container) return;
  const days = Math.max(1, featureNum(data.settings.repricingReviewDays) || 30);
  const cutoff = Date.now() - days * 86400000;
  const stale = data.items.filter((item) => !getSaleForItem(item.id) && new Date(item.listedAt || item.createdAt || Date.now()).getTime() < cutoff);
  container.innerHTML = stale.length ? stale.map((item) => `<article class="feature-row"><div><strong>${featureEsc(item.name)}</strong><p>${Math.floor((Date.now() - new Date(item.listedAt || item.createdAt).getTime()) / 86400000)} days listed · current price ${money(item.listedPrice)}${(item.priceHistory || []).length ? ` · ${item.priceHistory.length} prior price change(s)` : ""}</p></div><button class="secondary-button" type="button" data-reprice-review="${featureEsc(item.id)}">Review item</button></article>`).join("") : `<p class="muted-text">No unsold items are older than ${days} days.</p>`;
}

function renderConsignment() {
  const container = $("#consignmentReport");
  if (!container) return;
  const unpaid = featurePaidSales().filter((sale) => {
    const item = data.items.find((entry) => entry.id === sale.itemId);
    return item?.ownershipType === "consigned" && !sale.consignmentSettled && featureNum(sale.consignmentOwed) > 0;
  });
  container.innerHTML = `<p class="feature-total">Total owed: <strong>${money(data.funds.consignmentOwed || 0)}</strong></p>${unpaid.length ? unpaid.map((sale) => `<article class="feature-row"><div><strong>${featureEsc(featureItemName(sale.itemId))}</strong><p>Owner share ${money(sale.consignmentOwed)} · sale ${featureEsc(formatDate(sale.saleDate))}</p></div><button class="secondary-button" type="button" data-settle-consignment="${featureEsc(sale.id)}">Mark paid to owner</button></article>`).join("") : '<p class="muted-text">No unpaid consignment shares.</p>'}`;
}

function renderDocuments() {
  const container = $("#documentList");
  if (!container) return;
  container.innerHTML = data.documents.length ? data.documents.map((document) => `<article class="feature-row"><div><strong>${featureEsc(document.title)}</strong><p>${featureEsc(featureItemName(document.itemId))} · ${featureEsc(document.kind)} · ${featureEsc(formatDate(document.date))}</p></div><button class="secondary-button" type="button" data-open-document="${featureEsc(document.id)}">Open</button><button class="danger-button" type="button" data-delete-document="${featureEsc(document.id)}">Remove</button></article>`).join("") : '<p class="muted-text">Attach scanned receipt, grading, or shipping documents to an item.</p>';
}

const marketLookupCandidates = new Map();

function marketConfidence(sales90d) {
  if (sales90d >= 10) return "Strong recent sale activity";
  if (sales90d >= 3) return "Some recent sale activity";
  if (sales90d > 0) return "Limited recent sale activity";
  return "Sale count unavailable";
}

function renderMarketValuePanel(item) {
  const hasValue = item.marketValue !== undefined && item.marketValue !== null && item.marketValue !== "" && Number.isFinite(Number(item.marketValue));
  const cardGame = item.cardGame || (item.productCategory === "pokemon" ? "pokemon" : "other");
  const supportedGame = item.productCategory !== "sports" && cardGame !== "other";
  const timestamp = item.marketValueUpdatedAt ? new Date(item.marketValueUpdatedAt).toLocaleString() : "";
  const matchName = item.marketProviderCardName || "Manual value";
  const history = (Array.isArray(item.marketPriceHistory) ? item.marketPriceHistory : []).slice(-5).reverse();
  return `<section class="market-value-panel"><div class="panel-heading"><div><p class="eyebrow">CARD VALUE</p><h3>${hasValue ? money(item.marketValue) : "No value saved"}</h3></div>${item.marketValueSource ? `<span class="market-source-pill">${featureEsc(item.marketValueSource)}</span>` : ""}</div>
    ${hasValue ? `<p class="field-hint">${featureEsc(matchName)}${item.marketValueCondition ? ` · ${featureEsc(item.marketValueCondition)}` : ""}${item.marketValuePrinting ? ` · ${featureEsc(item.marketValuePrinting)}` : ""}${item.marketValueLanguage ? ` · ${featureEsc(item.marketValueLanguage)}` : ""}${timestamp ? ` · price date ${featureEsc(timestamp)}` : ""}${item.marketPriceStatus ? ` · ${featureEsc(item.marketPriceStatus)}` : ""}${item.marketConfidence ? ` · ${featureEsc(item.marketConfidence)}` : ""}${item.marketSales90d ? ` · ${item.marketSales90d} sales in 90 days` : ""}</p>` : '<p class="field-hint">Market values are separate from your bought cost and listed price.</p>'}
    ${supportedGame ? `<button class="secondary-button" type="button" data-market-search="${featureEsc(item.id)}" data-market-refresh="${featureEsc(item.marketProviderVariantId || "")}">${item.marketProviderVariantId ? "Refresh TCG value" : "Find TCG market value"}</button><p class="field-hint">Provider matches are suggestions. Confirm the exact card, set, number, printing, language, and condition or grade before saving.</p>` : `<p class="field-hint">Automatic pricing is not available for this card type yet. You can record a value manually; sports-card API pricing needs a licensed source.</p>`}
    <form class="market-manual-form" data-market-manual="${featureEsc(item.id)}"><label class="field">Market value ($)<input name="value" type="number" min="0" step="0.01" value="${hasValue ? featureEsc(item.marketValue) : ""}" required></label><button class="secondary-button" type="submit">Save manual value</button></form>
    ${item.marketValueSource === "JustTCG" ? '<button class="text-button market-clear-button" type="button" data-market-clear="' + featureEsc(item.id) + '">Remove saved provider value</button>' : ""}
    ${history.length ? `<div class="market-history"><strong>Recent value history</strong>${history.map((entry) => `<span>${money(entry.value)} · ${featureEsc(entry.source || "Manual")} · ${featureEsc(new Date(entry.recordedAt).toLocaleDateString())}</span>`).join("")}</div>` : ""}
    <div class="market-search-results" data-market-results="${featureEsc(item.id)}" aria-live="polite"></div></section>`;
}

function marketCandidateMarkup(item, card) {
  const wantedType = item.cardType === "graded" ? "graded" : "raw";
  const variants = (card.variants || []).filter((variant) => {
    if (variant.type !== wantedType) return false;
    if (wantedType === "graded") {
      const expectedGrade = `${item.gradingCompany || ""} ${item.cardGrade || ""}`.trim().toLowerCase();
      if (variant.grade.toLowerCase() !== expectedGrade) return false;
    } else if (item.itemCondition && item.itemCondition !== "Not specified" && normalizeFeatureKey(variant.condition) !== normalizeFeatureKey(item.itemCondition)) return false;
    if (item.cardPrinting && variant.printing && normalizeFeatureKey(variant.printing) !== normalizeFeatureKey(item.cardPrinting)) return false;
    if (item.cardLanguage && variant.language && normalizeFeatureKey(variant.language) !== normalizeFeatureKey(item.cardLanguage)) return false;
    return true;
  });
  const identityParts = [card.set, card.number && `#${card.number}`, card.rarity].filter(Boolean);
  const options = variants.map((variant) => {
    const token = featureId();
    marketLookupCandidates.set(token, { itemId: item.id, card, variant });
    const descriptor = wantedType === "graded" ? variant.grade : [variant.condition, variant.printing, variant.language].filter(Boolean).join(" · ");
    const current = variant.priceStatus === "current" && Number.isFinite(variant.price) && variant.price >= 0;
    return `<article class="market-variant-row"><div><strong>${featureEsc(descriptor || "Variant details incomplete")}</strong><p>${variant.price == null ? (variant.lastPrice == null ? "No provider value" : `Last recorded ${money(variant.lastPrice)} · expired`) : `${money(variant.price)} ${featureEsc(variant.currency)}`}${variant.sales90d ? ` · ${variant.sales90d} sales in 90 days` : ""}</p><small>${featureEsc(marketConfidence(variant.sales90d))}${variant.updatedAt ? ` · provider updated ${featureEsc(new Date(variant.updatedAt * 1000).toLocaleDateString())}` : ""}</small></div><button class="secondary-button" type="button" data-market-select="${featureEsc(token)}" ${current ? "" : "disabled"}>${current ? "Use this value" : "No current price"}</button></article>`;
  }).join("");
  return `<article class="market-card-result"><strong>${featureEsc(card.name)}</strong><p>${identityParts.map(featureEsc).join(" · ") || "Set/number not listed"} · ${featureEsc(card.game)}</p>${variants.length ? options : '<p class="field-hint">No variant exactly matched the saved condition/grade and printing. Check the card details or enter a manual value.</p>'}</article>`;
}

async function searchMarketValue(itemId, variantId = "") {
  const item = data.items.find((entry) => entry.id === itemId);
  const results = document.querySelector(`[data-market-results="${CSS.escape(itemId)}"]`);
  if (!item || !results) return;
  const cardGame = item.cardGame || (item.productCategory === "pokemon" ? "pokemon" : "other");
  if (item.productCategory === "sports" || cardGame === "other") {
    results.innerHTML = '<p class="field-hint">Choose a supported TCG game for provider lookup. Sports cards can use a manual value until a commercial source is available.</p>';
    return;
  }
  if (!variantId && !item.cardSet && !item.cardNumber) {
    results.innerHTML = '<p class="field-hint">Add the card set or number in Edit Item to narrow the match before searching.</p>';
    return;
  }
  results.innerHTML = '<p class="field-hint">Searching current TCG card values…</p>';
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const response = await fetch(cacheApiUrl("/api/card-price-search"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
      body: JSON.stringify({ game: cardGame, name: item.name, set: item.cardSet, number: item.cardNumber, printing: item.cardPrinting, language: item.cardLanguage, itemCondition: item.itemCondition, cardType: item.cardType, gradingCompany: item.gradingCompany, grade: item.cardGrade, variantId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Card market lookup is not configured yet.");
    const cards = payload.cards || [];
    results.innerHTML = cards.length ? `<p class="field-hint">Review the exact printing and number. Only a price you select below will be attached to inventory.</p>${cards.map((card) => marketCandidateMarkup(item, card)).join("")}` : '<p class="field-hint">No card match was found. Add or correct its set and number, then search again.</p>';
  } catch (error) {
    console.error("Card market lookup failed:", error);
    results.innerHTML = `<p class="field-hint error">${featureEsc(error.message || "Could not look up this card. Try again.")}</p>`;
  }
}

function updateFeeEstimator() {
  const form = $("#feeEstimatorForm");
  const output = $("#feeEstimatorResult");
  if (!form || !output) return;
  const value = featureFormData(form);
  const price = featureNum(value.salePrice);
  const offer = featureNum(value.offerPrice);
  const feeRate = Math.max(0, Math.min(100, featureNum(value.feePercent))) / 100;
  const fixedFee = featureNum(value.fixedFee);
  const shipping = featureNum(value.shipping);
  const purchase = featureNum(value.purchaseCost);
  const other = featureNum(value.other);
  const target = featureNum(value.targetProfit);
  const variableCosts = fixedFee + shipping + purchase + other;
  const fee = featureRound(price * feeRate + fixedFee);
  const net = featureRound(price - feeRate * price - fixedFee - shipping);
  const profit = featureRound(net - purchase - other);
  const breakeven = featureRound(variableCosts / Math.max(0.01, 1 - feeRate));
  const targetPrice = featureRound((variableCosts + target) / Math.max(0.01, 1 - feeRate));
  const offerProfit = featureRound(offer - offer * feeRate - fixedFee - shipping - purchase - other);
  const offerStatus = offer >= breakeven
    ? (offerProfit >= target ? `Meets your target by ${money(offerProfit - target)}` : `Above break-even, but ${money(target - offerProfit)} below your target`)
    : `Below break-even by ${money(breakeven - offer)}`;
  output.innerHTML = `Estimated platform fee: <strong>${money(fee)}</strong><br>Net after fees and shipping: <strong>${money(net)}</strong><br>Estimated profit after bought and other costs: <strong>${money(profit)}</strong><br>Break-even / minimum offer: <strong>${money(breakeven)}</strong><br>Offer profit at ${money(offer)}: <strong>${money(offerProfit)}</strong> · ${featureEsc(offerStatus)}<br>Price for ${money(target)} target profit: <strong>${money(targetPrice)}</strong>`;
}

function renderWorkspace() {
  renderSourcingLists();
  renderListingDrafts();
  renderBusinessTools();
  if ($("#draftCategory")) $("#draftCategory").innerHTML = Object.entries(CATEGORY_NAMES).map(([id, name]) => `<option value="${featureEsc(id)}">${featureEsc(name)}</option>`).join("");
}

$("#dealSearchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = featureFormData(event.currentTarget);
  const search = { id: featureId(), query: String(values.query).trim(), condition: values.condition || "any", maxCost: Math.max(0, featureNum(values.maxCost)), minProfit: Math.max(0, featureNum(values.minProfit)), minRoi: Math.max(0, featureNum(values.minRoi)), minimumComps: Math.max(1, featureNum(values.minimumComps)), maxShipping: Math.max(0, featureNum(values.maxShipping)), feePercent: Math.max(0, Math.min(100, featureNum(values.feePercent))), marketplace: "EBAY_US", active: true, alertsEnabled: false, alertedListingIds: [], createdAt: new Date().toISOString() };
  data.dealSearches.unshift(search);
  featurePersist();
  event.currentTarget.reset();
  event.currentTarget.elements.maxCost.value = "25";
  event.currentTarget.elements.minProfit.value = "10";
  event.currentTarget.elements.minRoi.value = "30";
  event.currentTarget.elements.minimumComps.value = "3";
  event.currentTarget.elements.maxShipping.value = "8";
  event.currentTarget.elements.feePercent.value = data.settings.defaultFeePercent;
});

$("#scanDealsButton").addEventListener("click", () => {
  const search = data.dealSearches.find((entry) => entry.active !== false);
  if (search) runDealSearch(search.id);
  else renderDealResults([], null, "Save at least one deal search first.");
});

$("#dealNotificationsButton").addEventListener("click", async () => {
  if (!("Notification" in window)) return featureToast("This browser does not support notifications. Your deal results still appear in CACHE.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return featureToast("Browser notifications were not enabled.");
  const search = data.dealSearches.find((entry) => entry.active !== false);
  if (!search) return featureToast("Save a deal search first.");
  search.alertsEnabled = true;
  featurePersist();
  featureToast("Deal alerts enabled while CACHE is open in this browser.");
});

$("#priceCompForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = featureFormData(event.currentTarget);
  data.priceComps.unshift({ id: featureId(), product: String(values.product).trim(), condition: String(values.condition).trim(), price: Math.max(0, featureNum(values.price)), soldDate: values.soldDate, source: String(values.source || "User entered").trim(), createdAt: new Date().toISOString() });
  event.currentTarget.reset();
  event.currentTarget.elements.soldDate.value = featureDate();
  featurePersist();
});

$("#sourceLogForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = featureFormData(event.currentTarget);
  data.sourcingLog.unshift({ id: featureId(), source: String(values.source).trim(), date: values.date, count: Math.max(1, featureNum(values.count)), cost: Math.max(0, featureNum(values.cost)), extra: Math.max(0, featureNum(values.extra)), notes: String(values.notes || "").trim() });
  event.currentTarget.reset();
  event.currentTarget.elements.date.value = featureDate();
  event.currentTarget.elements.count.value = "1";
  event.currentTarget.elements.extra.value = "0";
  featurePersist();
});

$("#buyPlanForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = featureFormData(event.currentTarget);
  data.buyPlans.unshift({ id: featureId(), name: String(values.name).trim(), buyPrice: Math.max(0, featureNum(values.buyPrice)), inbound: Math.max(0, featureNum(values.inbound)), resale: Math.max(0, featureNum(values.resale)), feePercent: Math.max(0, Math.min(100, featureNum(values.feePercent))), outbound: Math.max(0, featureNum(values.outbound)), createdAt: new Date().toISOString() });
  event.currentTarget.reset();
  event.currentTarget.elements.feePercent.value = data.settings.defaultFeePercent;
  event.currentTarget.elements.outbound.value = data.settings.defaultOutgoingShipping;
  featurePersist();
});

$("#manualDraftForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = featureFormData(event.currentTarget);
  data.listingDrafts.unshift({ id: featureId(), title: String(values.title).trim(), category: values.category || "other", condition: String(values.condition || "Not specified").trim(), description: String(values.description || "").trim(), listedPrice: values.price === "" ? null : Math.max(0, featureNum(values.price)), photos: [], purchaseCost: null, purchaseDate: "", status: "draft", createdAt: new Date().toISOString() });
  event.currentTarget.reset();
  featurePersist();
});

function featureFileToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not prepare this photo."));
    reader.readAsDataURL(blob);
  });
}

$("#aiDraftForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const files = [...$("#draftPhotoFiles").files];
  const status = $("#draftStatus");
  if (!files.length) return;
  if (files.length > 8) {
    status.textContent = "Choose up to 8 product photos per batch.";
    status.classList.add("error");
    return;
  }
  if (files.some((file) => !file.type.startsWith("image/") || file.size > 12 * 1024 * 1024)) {
    status.textContent = "Each file must be an image smaller than 12 MB.";
    status.classList.add("error");
    return;
  }
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  status.classList.remove("error");
  status.textContent = "Preparing photos and asking AI for listing suggestions…";
  try {
    const prepared = await Promise.all(files.map(async (file) => {
      const blob = await readPhoto(file);
      return { dataUrl: await featureFileToDataUrl(blob), blob };
    }));
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const response = await fetch(cacheApiUrl("/api/ai-draft"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
      body: JSON.stringify({ products: prepared.map((photo) => ({ imageData: photo.dataUrl })), context: String(new FormData(form).get("context") || ""), categories: Object.entries(CATEGORY_NAMES).map(([id, name]) => ({ id, name })) })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "AI draft service is not configured yet.");
    const generated = Array.isArray(payload.items) ? payload.items : [];
    if (generated.length !== files.length) throw new Error("The AI returned an incomplete batch. Nothing was added; try again with fewer photos.");
    const drafts = [];
    for (let index = 0; index < generated.length; index += 1) {
      const suggestion = generated[index];
      const id = featureId();
      let photoPath = "";
      try { photoPath = await uploadPhotoBlob(prepared[index].blob, id); }
      catch (uploadError) { console.warn("Draft photo upload failed:", uploadError); }
      drafts.push({ id, title: String(suggestion.title || "Review product title").slice(0, 140), category: Object.hasOwn(CATEGORY_NAMES, suggestion.category) ? suggestion.category : "other", condition: String(suggestion.condition || "Not specified").slice(0, 60), description: String(suggestion.description || "").slice(0, 4000), listedPrice: suggestion.suggestedPrice == null ? null : Math.max(0, featureNum(suggestion.suggestedPrice)), photos: photoPath ? [photoPath] : [], purchaseCost: null, purchaseDate: "", status: "draft", createdAt: new Date().toISOString(), aiGenerated: true });
    }
    data.listingDrafts.unshift(...drafts);
    featurePersist();
    status.textContent = `${drafts.length} draft(s) ready for your review. No purchase cost or date was generated.`;
    form.reset();
  } catch (error) {
    console.error("AI listing draft generation failed:", error);
    status.textContent = error.message || "Could not generate listing drafts. Your drafts were not changed.";
    status.classList.add("error");
  } finally {
    button.disabled = false;
  }
});

$("#feeEstimatorForm").addEventListener("input", updateFeeEstimator);
$("#goalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = featureFormData(event.currentTarget);
  data.goals.unshift({ id: featureId(), name: String(values.name).trim(), target: Math.max(0, featureNum(values.target)), period: values.period === "week" ? "week" : "month" });
  event.currentTarget.reset();
  featurePersist();
});

$("#gradingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = featureFormData(event.currentTarget);
  const item = data.items.find((entry) => entry.id === values.itemId);
  if (!item) return featureToast("Choose an inventory item.");
  const entry = { id: featureId(), itemId: item.id, company: String(values.company).trim(), date: values.date, fee: Math.max(0, featureNum(values.fee)), shipping: Math.max(0, featureNum(values.shipping)), estimatedValue: Math.max(0, featureNum(values.estimatedValue)), status: values.status || "Preparing" };
  data.gradingSubmissions.unshift(entry);
  item.additionalCostBasis = featureRound(featureNum(item.additionalCostBasis) + entry.fee + entry.shipping);
  item.gradingHistory = [...(item.gradingHistory || []), entry.id];
  featurePersist();
});

$("#shipmentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = featureFormData(event.currentTarget);
  const sale = data.sales.find((entry) => entry.id === values.saleId && entry.status === "paid");
  if (!sale) return featureToast("Choose a paid sale.");
  const shipment = { id: data.shipments.find((entry) => entry.saleId === sale.id)?.id || featureId(), saleId: sale.id, carrier: String(values.carrier || "").trim(), tracking: String(values.tracking || "").trim(), shipBy: values.shipBy || "", notes: String(values.notes || "").trim(), status: "Ready", createdAt: new Date().toISOString() };
  const index = data.shipments.findIndex((entry) => entry.saleId === sale.id);
  if (index >= 0) data.shipments[index] = { ...data.shipments[index], ...shipment };
  else data.shipments.unshift(shipment);
  featurePersist();
});

function reverseSaleAllocation(sale, item) {
  if (!sale?.fundsAllocated) return;
  const legacyRecovered = sale.allocationVersion ? 0 : featureNum(sale.capitalRecovered);
  data.funds.reinvestment = featureRound(featureNum(data.funds.reinvestment) - featureNum(sale.reinvestmentAdded) - legacyRecovered);
  data.funds.personal = featureRound(featureNum(data.funds.personal) - featureNum(sale.personalAdded));
  data.funds.consignmentOwed = featureRound(featureNum(data.funds.consignmentOwed) - featureNum(sale.consignmentOwed));
  if (data.funds.reinvestment < 0.005) data.funds.reinvestment = 0;
  if (data.funds.personal < 0.005) data.funds.personal = 0;
  if (data.funds.consignmentOwed < 0.005) data.funds.consignmentOwed = 0;
  sale.fundsAllocated = false;
  sale.reinvestmentAdded = 0;
  sale.personalAdded = 0;
  sale.consignmentOwed = 0;
}

$("#returnForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = featureFormData(event.currentTarget);
  const sale = data.sales.find((entry) => entry.id === values.saleId && entry.status === "paid");
  const item = sale && data.items.find((entry) => entry.id === sale.itemId);
  if (!sale || !item) return featureToast("Choose a paid sale.");
  const amount = featureRound(featureNum(values.amount));
  if (amount <= 0 || amount + featureNum(sale.refundAmount) > featureNum(sale.salePrice) + 0.001) {
    return featureToast("Refund amount must be positive and cannot exceed the unrefunded sale price.");
  }
  reverseSaleAllocation(sale, item);
  sale.refundAmount = featureRound(featureNum(sale.refundAmount) + amount);
  const returned = values.returned === "yes";
  sale.returnedToInventory = returned || sale.returnedToInventory;
  const isFullRefund = sale.refundAmount >= featureNum(sale.salePrice) - 0.005;
  if (isFullRefund) {
    sale.status = "refunded";
    sale.fundsAllocated = false;
  } else {
    allocatePaidSaleFunds(sale, item);
  }
  data.returnRecords.unshift({ id: featureId(), saleId: sale.id, amount, date: values.date, returned, notes: String(values.notes || "").trim(), fullRefund: isFullRefund, createdAt: new Date().toISOString() });
  event.currentTarget.reset();
  event.currentTarget.elements.date.value = featureDate();
  featurePersist();
});

function splitMoneyByWeight(total, weights) {
  const cents = Math.round(Math.max(0, total) * 100);
  const sum = weights.reduce((value, weight) => value + Math.max(0, weight), 0);
  const base = sum > 0 ? weights.map((weight) => Math.floor(cents * Math.max(0, weight) / sum)) : weights.map(() => Math.floor(cents / weights.length));
  let remainder = cents - base.reduce((value, amount) => value + amount, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % base.length) { base[index] += 1; remainder -= 1; }
  return base.map((amount) => amount / 100);
}

$("#bundleSaleForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = featureFormData(form);
  const itemIds = [...form.querySelectorAll('input[name="itemIds"]:checked')].map((input) => input.value);
  const items = itemIds.map((id) => data.items.find((item) => item.id === id)).filter((item) => item && !getSaleForItem(item.id));
  if (!items.length) return featureToast("Select at least one item that is still in inventory.");
  const weights = items.map((item) => values.splitMethod === "equal" ? 1 : Math.max(0.01, featureNum(item.listedPrice)));
  const prices = splitMoneyByWeight(featureNum(values.price), weights);
  const fees = splitMoneyByWeight(featureNum(values.fees), prices);
  const shipping = splitMoneyByWeight(featureNum(values.shipping), prices);
  const other = splitMoneyByWeight(featureNum(values.other), prices);
  const bundleId = featureId();
  for (let index = 0; index < items.length; index += 1) {
    data.sales.push({ id: featureId(), bundleId, itemId: items[index].id, salePrice: prices[index], platformFees: fees[index], shipping: shipping[index], otherCosts: other[index], platform: values.platform || "other", saleDate: values.date, status: "pending", reinvestmentPercent: 50, createdAt: new Date().toISOString() });
  }
  form.reset();
  form.elements.date.value = featureDate();
  featurePersist();
  featureToast(`Bundle sale recorded across ${items.length} items. Mark each payout paid after it clears.`);
});

function distributeCostLot(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = featureFormData(form);
  const itemIds = [...form.querySelectorAll('input[name="itemIds"]:checked')].map((input) => input.value);
  const items = itemIds.map((id) => data.items.find((item) => item.id === id)).filter(Boolean);
  if (!items.length) return featureToast("Choose the items included in this lot.");
  const weights = items.map((item) => values.method === "listed" ? Math.max(0.01, featureNum(item.listedPrice)) : 1);
  const allocations = splitMoneyByWeight(featureNum(values.cost), weights);
  const allocationRows = [];
  items.forEach((item, index) => {
    const amount = allocations[index];
    item.purchaseCost = featureRound(featureNum(item.purchaseCost) + amount);
    item.purchaseCostUnknown = false;
    item.purchaseCostEstimated = false;
    item.costLotId = featureId();
    item.costBasisNotes = (item.costBasisNotes || []).concat([{ amount, lotName: String(values.name).trim(), method: values.method, date: featureDate() }]);
    allocationRows.push({ itemId: item.id, amount });
  });
  data.lotPurchases.unshift({ id: featureId(), name: String(values.name).trim(), cost: featureRound(featureNum(values.cost)), method: values.method === "listed" ? "By listed value" : "Even split", date: featureDate(), allocations: allocationRows });
  form.reset();
  featurePersist();
}
$("#lotSplitForm").addEventListener("submit", distributeCostLot);

$("#repricingDays").addEventListener("change", (event) => {
  data.settings.repricingReviewDays = Math.max(1, Math.min(365, featureNum(event.currentTarget.value) || 30));
  saveData();
  renderRepricing();
});

$("#itemForm").elements.ownershipType.addEventListener("change", (event) => {
  $("#consignmentShareGroup").hidden = event.currentTarget.value !== "consigned";
  const cost = $("#purchaseCost");
  cost.required = event.currentTarget.value !== "consigned";
  if (event.currentTarget.value === "consigned") $("#skuScanMessage").textContent = "Consigned item costs may be left blank. Enter the owner's payout share.";
});

function fillSelectOptions(selector, items, label) {
  const select = $(selector);
  if (!select) return;
  select.innerHTML = items.map((item) => `<option value="${featureEsc(item.id)}">${featureEsc(label(item))}</option>`).join("");
}

$("#goalForm").elements.name.value = "";
$("#gradingForm").elements.date.value = featureDate();
$("#returnForm").elements.date.value = featureDate();
$("#sourceLogForm").elements.date.value = featureDate();
$("#priceCompForm").elements.soldDate.value = featureDate();
$("#bundleSaleForm").elements.date.value = featureDate();
$("#repricingDays").value = data.settings.repricingReviewDays || 30;

$("#scanSkuButton").addEventListener("click", async () => {
  const message = $("#skuScanMessage");
  if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
    message.textContent = "This browser does not support camera barcode scanning. You can type or paste the SKU in the field.";
    return;
  }
  let stream;
  const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  const overlay = document.createElement("div");
  overlay.className = "scanner-overlay";
  overlay.innerHTML = '<div class="scanner-card"><video playsinline muted></video><p>Point the camera at a barcode</p><button type="button" class="secondary-button">Cancel</button></div>';
  document.body.append(overlay);
  const liveVideo = overlay.querySelector("video");
  const cancel = () => { stream?.getTracks().forEach((track) => track.stop()); overlay.remove(); };
  overlay.querySelector("button").addEventListener("click", cancel);
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
    liveVideo.srcObject = stream;
    await liveVideo.play();
    message.textContent = "Camera open. Hold the barcode in frame.";
    while (overlay.isConnected) {
      const codes = await detector.detect(liveVideo);
      if (codes.length) {
        $("#itemSku").value = codes[0].rawValue;
        message.textContent = "Barcode added to SKU.";
        cancel();
        break;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
  } catch (error) {
    console.error("Barcode scan failed:", error);
    message.textContent = error.name === "NotAllowedError" ? "Camera access is blocked. Allow camera access or enter the SKU manually." : "Could not scan. Enter or paste the SKU instead.";
    cancel();
  }
});

$("#documentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = featureFormData(form);
  const file = $("#documentImage").files[0];
  const message = $("#documentStatus");
  if (!file || !file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
    message.textContent = "Choose a receipt or document image smaller than 12 MB.";
    message.classList.add("error");
    return;
  }
  const item = data.items.find((entry) => entry.id === values.itemId);
  if (!item) return;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  message.textContent = "Uploading privately…";
  try {
    const image = await readPhoto(file);
    const path = await uploadPhotoBlob(image, item.id);
    data.documents.unshift({ id: featureId(), itemId: item.id, title: String(values.title).trim(), kind: values.kind || "Receipt", path, date: featureDate(), createdAt: new Date().toISOString() });
    featurePersist();
    message.textContent = "Document image saved in your private account storage.";
    form.reset();
  } catch (error) {
    console.error("Private document upload failed:", error);
    message.textContent = error.message || "Could not upload the image. Try again.";
    message.classList.add("error");
  } finally { button.disabled = false; }
});

$("#documentForm").elements.itemId.addEventListener("focus", () => {
  fillSelectOptions("#documentForm [name=itemId]", data.items, (item) => item.name);
});

document.addEventListener("click", async (event) => {
  const target = event.target;
  const runDeal = target.closest("[data-run-deal]");
  if (runDeal) return runDealSearch(runDeal.dataset.runDeal);
  const deleteDeal = target.closest("[data-delete-deal]");
  if (deleteDeal) { data.dealSearches = data.dealSearches.filter((entry) => entry.id !== deleteDeal.dataset.deleteDeal); return featurePersist(); }
  const pauseDeal = target.closest("[data-pause-deal]");
  if (pauseDeal) { const search = data.dealSearches.find((entry) => entry.id === pauseDeal.dataset.pauseDeal); if (search) search.active = search.active === false; return featurePersist(); }
  const deleteComp = target.closest("[data-delete-comp]");
  if (deleteComp) { data.priceComps = data.priceComps.filter((entry) => entry.id !== deleteComp.dataset.deleteComp); return featurePersist(); }
  const deleteSource = target.closest("[data-delete-source]");
  if (deleteSource) { data.sourcingLog = data.sourcingLog.filter((entry) => entry.id !== deleteSource.dataset.deleteSource); return featurePersist(); }
  const deletePlan = target.closest("[data-delete-plan]");
  if (deletePlan) { data.buyPlans = data.buyPlans.filter((entry) => entry.id !== deletePlan.dataset.deletePlan); return featurePersist(); }
  const createInventory = target.closest("[data-draft-inventory]");
  if (createInventory) {
    const draft = data.listingDrafts.find((entry) => entry.id === createInventory.dataset.draftInventory);
    const card = createInventory.closest("[data-draft-card]");
    const costInput = card.querySelector("[data-draft-purchase-cost]");
    const dateInput = card.querySelector("[data-draft-purchase-date]");
    const cost = Number(costInput.value);
    if (!dateInput.value || !Number.isFinite(cost) || cost < 0) { return featureToast("Enter the actual purchase cost and date before adding this draft to inventory."); }
    const itemId = featureId();
    const photo = (draft.photos || []).find((entry) => typeof entry === "string") || "";
    data.items.unshift({ id: itemId, name: draft.title || "Untitled item", sku: "", productCategory: draft.category || "other", cardGame: draft.category === "pokemon" ? "pokemon" : "other", cardSet: "", cardNumber: "", cardPrinting: "", cardLanguage: "", listedPrice: featureNum(draft.listedPrice), purchaseCost: featureRound(cost), purchaseCostUnknown: false, purchaseCostEstimated: false, purchaseDate: dateInput.value, itemCondition: draft.condition || "Not specified", photo, photos: (draft.photos || []).filter((path) => !String(path).startsWith("data:")), notes: draft.description || "", createdAt: new Date().toISOString(), listedAt: new Date().toISOString(), priceHistory: [] });
    draft.inventoryItemId = itemId;
    draft.status = "inventory-created";
    featurePersist();
    featureToast("Inventory item created. The draft remains saved; publishing still requires the eBay connection.");
    return;
  }
  const deleteDraft = target.closest("[data-delete-draft]");
  if (deleteDraft) { data.listingDrafts = data.listingDrafts.filter((entry) => entry.id !== deleteDraft.dataset.deleteDraft); return featurePersist(); }
  const splitDraft = target.closest("[data-split-draft]");
  if (splitDraft) {
    const draft = data.listingDrafts.find((entry) => entry.id === splitDraft.dataset.splitDraft);
    if (!draft || draft.photos.length < 2) return;
    const children = draft.photos.map((photo, index) => ({ ...draft, id: featureId(), title: `${draft.title} · ${index + 1}`, photos: [photo], purchaseDate: "", purchaseCost: null, inventoryItemId: null, status: "draft", parentDraftId: draft.id }));
    data.listingDrafts = data.listingDrafts.filter((entry) => entry.id !== draft.id);
    data.listingDrafts.unshift(...children);
    return featurePersist();
  }
  const deleteGoal = target.closest("[data-delete-goal]");
  if (deleteGoal) { data.goals = data.goals.filter((entry) => entry.id !== deleteGoal.dataset.deleteGoal); return featurePersist(); }
  const deleteGrading = target.closest("[data-delete-grading]");
  if (deleteGrading) {
    const entry = data.gradingSubmissions.find((record) => record.id === deleteGrading.dataset.deleteGrading);
    if (entry) { const item = data.items.find((record) => record.id === entry.itemId); if (item) item.additionalCostBasis = featureRound(Math.max(0, featureNum(item.additionalCostBasis) - featureNum(entry.fee) - featureNum(entry.shipping))); }
    data.gradingSubmissions = data.gradingSubmissions.filter((record) => record.id !== deleteGrading.dataset.deleteGrading);
    return featurePersist();
  }
  const reviewReprice = target.closest("[data-reprice-review]");
  if (reviewReprice) return openItemDetails(reviewReprice.dataset.repriceReview);
  const settle = target.closest("[data-settle-consignment]");
  if (settle) {
    const sale = data.sales.find((entry) => entry.id === settle.dataset.settleConsignment);
    if (sale && !sale.consignmentSettled) { data.funds.consignmentOwed = featureRound(Math.max(0, featureNum(data.funds.consignmentOwed) - featureNum(sale.consignmentOwed))); sale.consignmentSettled = true; sale.consignmentSettledAt = new Date().toISOString(); featurePersist(); }
    return;
  }
  const documentOpen = target.closest("[data-open-document]");
  if (documentOpen) {
    const doc = data.documents.find((entry) => entry.id === documentOpen.dataset.openDocument);
    if (!doc) return;
    const { data: signed, error } = await supabaseClient.storage.from(PHOTO_BUCKET).createSignedUrl(doc.path, 600);
    if (error) return featureToast("Could not open this private document. Check sync and retry.");
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const documentDelete = target.closest("[data-delete-document]");
  if (documentDelete) {
    const doc = data.documents.find((entry) => entry.id === documentDelete.dataset.deleteDocument);
    if (doc) { await supabaseClient.storage.from(PHOTO_BUCKET).remove([doc.path]); data.documents = data.documents.filter((entry) => entry.id !== doc.id); featurePersist(); }
    return;
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  const draftId = target.dataset.draftId;
  if (draftId && target.dataset.draftField) {
    const draft = data.listingDrafts.find((entry) => entry.id === draftId);
    if (draft) {
      const field = target.dataset.draftField;
      draft[field] = field === "listedPrice" ? (target.value === "" ? null : Math.max(0, featureNum(target.value))) : target.value;
      saveData();
      renderListingDrafts();
    }
  }
  if (target.matches("[data-grading-status]")) {
    const item = data.gradingSubmissions.find((entry) => entry.id === target.dataset.gradingStatus);
    if (item) { item.status = target.value; saveData(); renderGrading(); }
  }
  if (target.matches("[data-shipment-status]")) {
    const shipment = data.shipments.find((entry) => entry.id === target.dataset.shipmentStatus);
    if (shipment) { shipment.status = target.value; saveData(); renderShipments(); }
  }
});

$("#listingDraftList").addEventListener("click", (event) => {
  const combine = event.target.closest("[data-combine-drafts]");
  if (!combine) return;
  const ids = [...$("#listingDraftList").querySelectorAll("[data-select-draft]:checked")].map((checkbox) => checkbox.dataset.selectDraft);
  const selected = data.listingDrafts.filter((draft) => ids.includes(draft.id) && !draft.inventoryItemId);
  if (selected.length < 2) return featureToast("Select at least two drafts to combine.");
  const main = selected[0];
  main.photos = selected.flatMap((draft) => draft.photos || []);
  main.title = selected.map((draft) => draft.title).filter(Boolean).join(" + ").slice(0, 140);
  main.description = selected.map((draft) => draft.description).filter(Boolean).join("\n\n");
  const removed = new Set(selected.slice(1).map((draft) => draft.id));
  data.listingDrafts = data.listingDrafts.filter((draft) => !removed.has(draft.id));
  featurePersist();
});

$("#listingDraftList").insertAdjacentHTML("beforebegin", '<div class="detail-actions draft-batch-actions"><button class="secondary-button" type="button" data-combine-drafts>Combine selected drafts</button></div>');

document.addEventListener("input", (event) => {
  if (event.target.closest("#feeEstimatorForm")) updateFeeEstimator();
});

document.addEventListener("click", (event) => {
  const search = event.target.closest("[data-market-search]");
  if (search) return searchMarketValue(search.dataset.marketSearch, search.dataset.marketRefresh || "");

  const select = event.target.closest("[data-market-select]");
  if (select) {
    const match = marketLookupCandidates.get(select.dataset.marketSelect);
    const item = match && data.items.find((entry) => entry.id === match.itemId);
    if (!match || !item || !Number.isFinite(match.variant.price) || match.variant.price < 0 || match.variant.priceStatus !== "current") return;
    const now = new Date().toISOString();
    const priorHistory = Array.isArray(item.marketPriceHistory) ? item.marketPriceHistory : [];
    if (item.marketValue !== undefined && Number(item.marketValue) !== match.variant.price) {
      priorHistory.push({ value: Number(item.marketValue), source: item.marketValueSource || "Manual", recordedAt: item.marketValueFetchedAt || item.marketValueUpdatedAt || now });
    }
    item.marketValue = featureRound(match.variant.price);
    item.marketValueCurrency = match.variant.currency || "USD";
    item.marketValueSource = "JustTCG";
    item.marketValueUpdatedAt = match.variant.updatedAt ? new Date(match.variant.updatedAt * 1000).toISOString() : now;
    item.marketValueFetchedAt = now;
    item.marketValueCondition = match.variant.type === "graded" ? match.variant.grade : match.variant.condition;
    item.marketValuePrinting = match.variant.printing || "";
    item.marketValueLanguage = match.variant.language || "";
    item.marketProviderCardId = match.card.id;
    item.marketProviderCardName = [match.card.name, match.card.set, match.card.number && `#${match.card.number}`].filter(Boolean).join(" · ");
    item.marketProviderVariantId = match.variant.id;
    item.marketPriceStatus = match.variant.priceStatus;
    item.marketSales90d = match.variant.sales90d;
    item.marketConfidence = marketConfidence(match.variant.sales90d);
    item.marketPriceHistory = priorHistory.slice(-19).concat([{ value: item.marketValue, source: "JustTCG", recordedAt: now, priceUpdatedAt: item.marketValueUpdatedAt }]);
    marketLookupCandidates.clear();
    featurePersist();
    openItemDetails(item.id);
    return;
  }

  const clear = event.target.closest("[data-market-clear]");
  if (clear) {
    const item = data.items.find((entry) => entry.id === clear.dataset.marketClear);
    if (!item) return;
    ["marketValue", "marketValueCurrency", "marketValueSource", "marketValueUpdatedAt", "marketValueFetchedAt", "marketValueCondition", "marketValuePrinting", "marketValueLanguage", "marketProviderCardId", "marketProviderCardName", "marketProviderVariantId", "marketPriceStatus", "marketSales90d", "marketConfidence", "marketPriceHistory"]
      .forEach((key) => { delete item[key]; });
    featurePersist();
    openItemDetails(item.id);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-market-manual]");
  if (!form) return;
  event.preventDefault();
  const item = data.items.find((entry) => entry.id === form.dataset.marketManual);
  const value = Number(new FormData(form).get("value"));
  if (!item || !Number.isFinite(value) || value < 0) return featureToast("Enter a valid market value.");
  const now = new Date().toISOString();
  const history = Array.isArray(item.marketPriceHistory) ? item.marketPriceHistory : [];
  if (item.marketValue !== undefined && Number(item.marketValue) !== value) history.push({ value: Number(item.marketValue), source: item.marketValueSource || "Manual", recordedAt: item.marketValueFetchedAt || item.marketValueUpdatedAt || now });
  item.marketValue = featureRound(value);
  item.marketValueCurrency = "USD";
  item.marketValueSource = "Manual";
  item.marketValueUpdatedAt = now;
  item.marketValueFetchedAt = now;
  item.marketValueCondition = item.cardType === "graded" ? `${item.gradingCompany || ""} ${item.cardGrade || ""}`.trim() : (item.itemCondition || "Not specified");
  item.marketValuePrinting = item.cardPrinting || "";
  item.marketValueLanguage = item.cardLanguage || "";
  ["marketProviderCardId", "marketProviderCardName", "marketProviderVariantId", "marketPriceStatus", "marketSales90d", "marketConfidence"].forEach((key) => { delete item[key]; });
  item.marketPriceHistory = history.slice(-19).concat([{ value: item.marketValue, source: "Manual", recordedAt: now }]);
  featurePersist();
  openItemDetails(item.id);
});

renderWorkspace();
