"use strict";

/* CACHE reseller workspace features. Data stays inside the signed-in user's existing RLS-protected payload. */

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
function normalizeFeatureKey(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function renderSourcingLists() {
  const comps = $("#priceCompList");
  if (comps) comps.innerHTML = data.priceComps.length ? [...data.priceComps].sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || "")).map((comp) => `<article class="feature-row"><div><strong>${featureEsc(comp.product)}</strong><p>${featureEsc(comp.condition)} · ${money(comp.price)} · ${featureEsc(formatDate(comp.soldDate))} · ${featureEsc(comp.source || "Manual comp")}</p></div><button class="danger-button" type="button" data-delete-comp="${featureEsc(comp.id)}">Remove</button></article>`).join("") : '<p class="muted-text">Save sale prices you have verified as a personal reference.</p>';
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

const themePickerKeys = { themeMainColor: "main", themeSecondaryColor: "secondary", themeTextColor: "text" };
function updateThemePreview(event) {
  const key = themePickerKeys[event.currentTarget.id];
  if (!key) return;
  const preview = { ...data.settings.theme, [key]: event.currentTarget.value };
  applyThemeSettings(false, preview);
  const message = $("#themeSettingsMessage");
  if (key === "text" && Math.min(colorContrast(preview.text, "#0d1012"), colorContrast(preview.text, "#171e22")) < 4.5) {
    message.textContent = "That text color may be difficult to read on CACHE’s dark background. Choose a brighter shade before saving.";
    message.classList.add("error");
  } else {
    message.textContent = "Previewing your colors. They will save when you finish choosing.";
    message.classList.remove("error");
  }
}

async function saveThemeSelection(event) {
  const key = themePickerKeys[event.currentTarget.id];
  const value = event.currentTarget.value;
  const message = $("#themeSettingsMessage");
  if (!key) return;
  if (key === "text" && Math.min(colorContrast(value, "#0d1012"), colorContrast(value, "#171e22")) < 4.5) {
    message.textContent = "Choose a brighter text color for readable contrast; the saved color was restored.";
    message.classList.add("error");
    applyThemeSettings();
    return;
  }
  data.settings.theme[key] = normalizeThemeColor(value, DEFAULT_THEME[key]);
  applyThemeSettings();
  message.textContent = "Saving your colors to your CACHE account…";
  message.classList.remove("error");
  if (!saveData()) {
    message.textContent = "Sign in to save your color choices.";
    message.classList.add("error");
    return;
  }
  const saved = await lastCloudSave;
  if (saved) message.textContent = "Your colors are saved and will sync to your other devices.";
  else {
    message.textContent = "Colors are saved on this device, but cloud sync needs attention. Use the sync button at the top to retry.";
    message.classList.add("error");
  }
}

Object.keys(themePickerKeys).forEach((id) => {
  const picker = $(`#${id}`);
  picker.addEventListener("input", updateThemePreview);
  picker.addEventListener("change", saveThemeSelection);
});

let ebayActiveRows = [];
let ebayActiveCostPercent = 50;

function parseEbayActiveCsv(text) {
  if (text.length > 20_000_000) throw new Error("This CSV is too large to preview. Export a smaller report and try again.");
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeCsvHeader);
    const hasTitle = headers.some((value) => ["title", "itemtitle", "listingtitle", "item"].includes(value) || value.startsWith("itemtitle"));
    const hasPrice = headers.some((value) => ["currentprice", "buyitnowprice", "listingprice", "startprice", "price", "itemprice"].includes(value) || value.startsWith("currentprice"));
    return hasTitle && hasPrice;
  });
  if (headerIndex < 0) throw new Error("I couldn't find listing title and current price columns. Choose an eBay Active Listings CSV report.");

  const headers = rows[headerIndex];
  const titleColumn = findCsvColumn(headers, ["itemtitle", "listingtitle", "title", "item"]);
  const priceColumn = findCsvColumn(headers, ["currentprice", "buyitnowprice", "listingprice", "startprice", "itemprice", "price"]);
  const skuColumn = findCsvColumn(headers, ["customlabelsku", "customlabel", "sku"]);
  const idColumn = findCsvColumn(headers, ["ebayitemid", "itemnumber", "listingid"]);
  const conditionColumn = findCsvColumn(headers, ["condition"]);
  const categoryColumn = findCsvColumn(headers, ["ebaycategory1name", "ebaycategory2name", "categoryname", "category"]);
  const quantityColumn = findCsvColumn(headers, ["availablequantity", "quantityavailable", "quantity", "qty"]);
  const currencyColumn = findCsvColumn(headers, ["currency"]);
  const urlColumn = findCsvColumn(headers, ["listingurl", "itemurl", "url"]);
  const seen = new Set();
  const existingIds = new Set(data.items.map((item) => String(item.ebayItemId || "").trim()).filter(Boolean));
  const existingSkus = new Set(data.items.map((item) => String(item.sku || "").trim().toLowerCase()).filter(Boolean));
  const existingListings = new Set(data.items.filter((item) => !item.ebayItemId && !item.sku).map((item) => `${normalizeFeatureKey(item.name)}|${featureNum(item.listedPrice).toFixed(2)}`));

  return rows.slice(headerIndex + 1).map((cells, offset) => {
    const value = (column) => column < 0 ? "" : String(cells[column] || "").trim();
    const title = value(titleColumn);
    const listingId = value(idColumn);
    const sku = value(skuColumn);
    const price = parseCsvMoney(value(priceColumn));
    const quantityValue = quantityColumn < 0 || !value(quantityColumn) ? 1 : Number.parseInt(value(quantityColumn), 10);
    const quantity = Number.isInteger(quantityValue) && quantityValue > 0 && quantityValue <= 500 ? quantityValue : 0;
    const currency = value(currencyColumn).toUpperCase();
    const key = listingId ? `id:${listingId}` : sku ? `sku:${sku.toLowerCase()}` : `listing:${normalizeFeatureKey(title)}|${Number(price || 0).toFixed(2)}`;
    const isDuplicate = Boolean(title && (seen.has(key) || (listingId && existingIds.has(listingId)) || (sku && existingSkus.has(sku.toLowerCase())) || (!listingId && !sku && existingListings.has(`${normalizeFeatureKey(title)}|${Number(price || 0).toFixed(2)}`))));
    if (title && key) seen.add(key);
    const state = !title || price === null || price < 0 || !quantity ? "invalid" : (currency && currency !== "USD") ? "unsupported-currency" : isDuplicate ? "duplicate" : "ready";
    return {
      rowNumber: headerIndex + offset + 2,
      title,
      listingId,
      sku,
      condition: value(conditionColumn),
      category: value(categoryColumn),
      currency,
      url: value(urlColumn),
      listedPrice: price,
      quantity: quantity || 1,
      purchaseCost: price === null ? 0 : featureRound(price * ebayActiveCostPercent / 100),
      purchaseCostEstimated: true,
      state,
      include: state === "ready"
    };
  }).filter((row) => row.title || row.listedPrice !== null);
}

function ebayInventoryCategory(categoryName) {
  const category = normalizeFeatureKey(categoryName);
  if (/pokemon|pokemon card/.test(category)) return "pokemon";
  if (/sport|baseball|basketball|football|hockey card/.test(category)) return "sports";
  if (/trading card|collectible card|tcg/.test(category)) return "trading";
  if (/video game|video games|gaming/.test(category)) return "videogames";
  if (/electronics|computer|phone|audio/.test(category)) return "electronics";
  if (/clothing|apparel|shoes|fashion/.test(category)) return "clothing";
  if (/collectible|memorabilia|toy|antique/.test(category)) return "collectibles";
  return "other";
}

function renderEbayActivePreview() {
  const preview = $("#ebayActivePreview");
  if (!preview) return;
  const ready = ebayActiveRows.filter((row) => row.state === "ready");
  const selected = ready.filter((row) => row.include).length;
  const status = (row) => row.state === "duplicate" ? "Already in inventory" : row.state === "unsupported-currency" ? `Currency ${row.currency} not supported` : row.state === "invalid" ? "Missing title, price, or quantity must be 1–500" : row.state === "imported" ? "Added to inventory" : row.purchaseCostEstimated ? "Estimated cost" : "Cost edited";
  preview.innerHTML = ebayActiveRows.length ? `<table class="report-table ebay-active-preview-table"><thead><tr><th><input type="checkbox" data-ebay-active-select-all aria-label="Select all importable listings" ${ready.length && selected === ready.length ? "checked" : ""} ${ready.length ? "" : "disabled"}></th><th>Active listing</th><th>Condition</th><th>Listed price</th><th>Bought cost</th><th>Import status</th></tr></thead><tbody>${ebayActiveRows.map((row, index) => `<tr><td><input type="checkbox" data-ebay-active-row="${index}" aria-label="Select ${featureEsc(row.title)}" ${row.include ? "checked" : ""} ${row.state === "ready" ? "" : "disabled"}></td><td>${featureEsc(row.title)}${row.sku ? `<small class="import-sku">SKU ${featureEsc(row.sku)}</small>` : ""}${row.listingId ? `<small class="import-sku">eBay #${featureEsc(row.listingId)} · qty ${row.quantity}</small>` : `<small class="import-sku">Qty ${row.quantity}</small>`}</td><td>${featureEsc(row.condition || "Not specified")}</td><td>${money(row.listedPrice)}</td><td><input class="ebay-cost-input" type="number" min="0" step="0.01" aria-label="Estimated bought cost for ${featureEsc(row.title)}" data-ebay-active-cost="${index}" value="${featureNum(row.purchaseCost).toFixed(2)}" ${row.state === "ready" ? "" : "disabled"}><small class="import-sku">${row.purchaseCostEstimated ? `${ebayActiveCostPercent}% of listed price · estimate` : "Manually entered"}</small></td><td>${status(row)}</td></tr>`).join("")}</tbody></table>` : "";
  const skipped = ebayActiveRows.filter((row) => ["duplicate", "invalid", "unsupported-currency"].includes(row.state)).length;
  $("#ebayActiveImportSummary").textContent = ebayActiveRows.length ? `${ebayActiveRows.length} listing rows · ${selected} selected · ${skipped} duplicate or invalid rows skipped. The percentage estimates per-unit cost from listed price; it is not an actual purchase record.` : "";
  $("#importEbayActiveButton").disabled = selected === 0;
  $("#cancelEbayActiveButton").hidden = ebayActiveRows.length === 0;
}

$("#ebayActiveCsvFile").addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  try {
    ebayActiveCostPercent = Number($("#ebayActiveCostPercent").value);
    ebayActiveRows = parseEbayActiveCsv(await file.text());
    $("#ebayActiveImportSummary").classList.remove("error");
    renderEbayActivePreview();
  } catch (error) {
    ebayActiveRows = [];
    renderEbayActivePreview();
    $("#ebayActiveImportSummary").textContent = error.message || "Could not read this eBay report.";
    $("#ebayActiveImportSummary").classList.add("error");
  }
});

$("#ebayActiveCostPercent").addEventListener("input", (event) => {
  ebayActiveCostPercent = Math.max(0, Math.min(100, featureNum(event.currentTarget.value)));
  $("#ebayActiveCostLabel").textContent = `${ebayActiveCostPercent}% of listed price`;
  ebayActiveRows.forEach((row) => {
    if (row.state === "ready" && row.purchaseCostEstimated) row.purchaseCost = featureRound(row.listedPrice * ebayActiveCostPercent / 100);
  });
  renderEbayActivePreview();
});

$("#ebayActivePreview").addEventListener("input", (event) => {
  const target = event.target;
  if (!target.matches("[data-ebay-active-cost]")) return;
  const row = ebayActiveRows[Number(target.dataset.ebayActiveCost)];
  const cost = Number(target.value);
  if (!row) return;
  if (target.value === "") row.purchaseCost = "";
  else if (Number.isFinite(cost) && cost >= 0) row.purchaseCost = featureRound(cost);
  else return;
  row.purchaseCostEstimated = false;
  const label = target.parentElement.querySelector(".import-sku");
  if (label) label.textContent = "Manually entered";
  const statusCell = target.closest("tr")?.lastElementChild;
  if (statusCell) statusCell.textContent = "Cost edited";
});

$("#ebayActivePreview").addEventListener("change", (event) => {
  if (event.target.matches("[data-ebay-active-row]")) {
    ebayActiveRows[Number(event.target.dataset.ebayActiveRow)].include = event.target.checked;
    renderEbayActivePreview();
  }
  if (event.target.matches("[data-ebay-active-select-all]")) {
    ebayActiveRows.forEach((row) => { if (row.state === "ready") row.include = event.target.checked; });
    renderEbayActivePreview();
  }
});

$("#importEbayActiveButton").addEventListener("click", () => {
  const selected = ebayActiveRows.filter((row) => row.state === "ready" && row.include);
  if (!selected.length) return;
  if (selected.some((row) => row.purchaseCost === "" || !Number.isFinite(Number(row.purchaseCost)) || Number(row.purchaseCost) < 0)) {
    $("#ebayActiveImportSummary").textContent = "Enter a valid nonnegative bought cost for each selected listing.";
    $("#ebayActiveImportSummary").classList.add("error");
    return;
  }
  const previousData = JSON.parse(JSON.stringify(data));
  let importedUnits = 0;
  try {
    for (const row of selected) {
      for (let copy = 0; copy < row.quantity; copy += 1) {
        data.items.push({
          id: makeId(), name: row.title, sku: row.sku, ebayItemId: row.listingId || "", ebayListingUrl: row.url || "",
          productCategory: ebayInventoryCategory(row.category), listedPrice: featureRound(row.listedPrice), purchaseCost: featureRound(row.purchaseCost),
          purchaseCostUnknown: false, purchaseCostEstimated: Boolean(row.purchaseCostEstimated), purchaseDate: "",
          itemCondition: row.condition || "Not specified", ownershipType: "owned", consignmentPercent: 0,
          photo: "", listedAt: new Date().toISOString(), priceHistory: [],
          purchaseSource: "eBay active listings import",
          notes: row.purchaseCostEstimated
            ? `Imported from an eBay active listings report. Bought cost is an estimate (${ebayActiveCostPercent}% of listed price); replace it with the actual amount paid when known.`
            : "Imported from an eBay active listings report. Entered bought cost manually.",
          createdAt: new Date().toISOString()
        });
        importedUnits += 1;
      }
      row.state = "imported";
      row.include = false;
    }
    if (!saveData()) throw new Error("Sign in before importing listings.");
    renderAll();
    renderEbayActivePreview();
    $("#ebayActiveImportSummary").textContent = `${importedUnits} active listing${importedUnits === 1 ? "" : "s"} added to inventory. Estimated costs are labeled; add actual costs when you know them.`;
    $("#ebayActiveImportSummary").classList.remove("error");
  } catch (error) {
    data = normalizeData(previousData);
    selected.forEach((row) => { if (row.state === "imported") { row.state = "ready"; row.include = true; } });
    renderEbayActivePreview();
    $("#ebayActiveImportSummary").textContent = error.message || "Could not import the selected listings.";
    $("#ebayActiveImportSummary").classList.add("error");
  }
});

$("#cancelEbayActiveButton").addEventListener("click", () => {
  ebayActiveRows = [];
  $("#ebayActiveCsvFile").value = "";
  $("#ebayActiveImportSummary").classList.remove("error");
  renderEbayActivePreview();
});

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

function renderMarketValuePanel(item) {
  const hasValue = item.marketValue !== undefined && item.marketValue !== null && item.marketValue !== "" && Number.isFinite(Number(item.marketValue));
  const timestamp = item.marketValueUpdatedAt ? new Date(item.marketValueUpdatedAt).toLocaleDateString() : "";
  const history = (Array.isArray(item.marketPriceHistory) ? item.marketPriceHistory : []).slice(-5).reverse();
  return `<section class="market-value-panel"><div class="panel-heading"><div><p class="eyebrow">RECORDED VALUE</p><h3>${hasValue ? money(item.marketValue) : "No value saved"}</h3></div>${item.marketValueSource ? `<span class="market-source-pill">${featureEsc(item.marketValueSource)}</span>` : ""}</div>
    ${hasValue ? `<p class="field-hint">Saved reference value${item.marketValueSource ? ` from ${featureEsc(item.marketValueSource)}` : ""}${item.marketValueCondition ? ` · ${featureEsc(item.marketValueCondition)}` : ""}${timestamp ? ` · updated ${featureEsc(timestamp)}` : ""}. This is not a live quote.</p>` : '<p class="field-hint">Enter your own estimate. CACHE does not fetch live market prices in this version.</p>'}
    <form class="market-manual-form" data-market-manual="${featureEsc(item.id)}"><label class="field">Your value estimate ($)<input name="value" type="number" min="0" step="0.01" value="${hasValue ? featureEsc(item.marketValue) : ""}" required></label><button class="secondary-button" type="submit">Save value</button></form>
    ${history.length ? `<div class="market-history"><strong>Recent recorded values</strong>${history.map((entry) => `<span>${money(entry.value)} · ${featureEsc(entry.source || "Manual")} · ${featureEsc(new Date(entry.recordedAt).toLocaleDateString())}</span>`).join("")}</div>` : ""}</section>`;
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
  renderBusinessTools();
}

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
  const deleteComp = target.closest("[data-delete-comp]");
  if (deleteComp) { data.priceComps = data.priceComps.filter((entry) => entry.id !== deleteComp.dataset.deleteComp); return featurePersist(); }
  const deleteSource = target.closest("[data-delete-source]");
  if (deleteSource) { data.sourcingLog = data.sourcingLog.filter((entry) => entry.id !== deleteSource.dataset.deleteSource); return featurePersist(); }
  const deletePlan = target.closest("[data-delete-plan]");
  if (deletePlan) { data.buyPlans = data.buyPlans.filter((entry) => entry.id !== deletePlan.dataset.deletePlan); return featurePersist(); }
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
  if (target.matches("[data-grading-status]")) {
    const item = data.gradingSubmissions.find((entry) => entry.id === target.dataset.gradingStatus);
    if (item) { item.status = target.value; saveData(); renderGrading(); }
  }
  if (target.matches("[data-shipment-status]")) {
    const shipment = data.shipments.find((entry) => entry.id === target.dataset.shipmentStatus);
    if (shipment) { shipment.status = target.value; saveData(); renderShipments(); }
  }
});

document.addEventListener("input", (event) => {
  if (event.target.closest("#feeEstimatorForm")) updateFeeEstimator();
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-market-manual]");
  if (!form) return;
  event.preventDefault();
  const item = data.items.find((entry) => entry.id === form.dataset.marketManual);
  const value = Number(new FormData(form).get("value"));
  if (!item || !Number.isFinite(value) || value < 0) return featureToast("Enter a valid value estimate.");
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
