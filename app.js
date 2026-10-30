"use strict";

/* =========================================
   CACHE — APPLICATION
========================================= */

const STORAGE_KEY = "resellledger_data_v1";
const CLOUD_TABLE = "cache_user_data";
const PHOTO_BUCKET = "cache-item-photos";
const supabaseClient = window.supabase.createClient(
  window.CACHE_SUPABASE_URL,
  window.CACHE_SUPABASE_PUBLISHABLE_KEY
);
let supabaseUser = null;
let loadedUserId = null;
let remoteSaveQueue = Promise.resolve();

const CATEGORY_NAMES = {
  pokemon: "Pokémon cards",
  sports: "Sports cards",
  trading: "Other trading cards",
  videogames: "Video games",
  electronics: "Electronics",
  clothing: "Clothing",
  collectibles: "Collectibles",
  other: "Other"
};

const CATEGORY_COLORS = [
  "#efff00",
  "#a6adad",
  "#737b82",
  "#454b50",
  "#c9ced1",
  "#39d98a",
  "#e4b94b",
  "#a98bff"
];

const STANDARD_CONDITIONS = [
  "Not specified", "New", "Like new", "Excellent",
  "Good", "Fair", "Poor", "Damaged"
];

const POKEMON_CONDITIONS = [
  "Not specified", "Near Mint", "Lightly Played",
  "Moderately Played", "Heavily Played", "Damaged"
];

const $ = (selector) => document.querySelector(selector);

let salesChart = null;
const signedPhotoUrls = new Map();
let ebayImportRows = [];

/* =========================================
   DATA STORAGE
========================================= */

function createEmptyData() {
  return {
    items: [],
    sales: [],
    customCategories: [],
    funds: {
      capital: 0,
      reinvestment: 0,
      personal: 0
    }
  };
}

function normalizeData(saved) {
  return {
    items: Array.isArray(saved?.items) ? saved.items : [],
    sales: Array.isArray(saved?.sales) ? saved.sales : [],
    customCategories: Array.isArray(saved?.customCategories)
      ? saved.customCategories : [],
    funds: {
      capital: Number(saved?.funds?.capital) || 0,
      reinvestment: Number(saved?.funds?.reinvestment) || 0,
      personal: Number(saved?.funds?.personal) || 0
    }
  };
}

function loadData(storageKey = STORAGE_KEY) {
  try {
    const stored = localStorage.getItem(storageKey);

    if (!stored) return createEmptyData();

    return normalizeData(JSON.parse(stored));
  } catch (error) {
    console.error("Could not load data:", error);
    return createEmptyData();
  }
}

let data = createEmptyData();

function applyCustomCategoryNames() {
  data.customCategories.forEach((category) => {
    CATEGORY_NAMES[category.id] = category.name;
  });
}

applyCustomCategoryNames();

function saveData() {
  const userId = supabaseUser?.id;
  if (!userId) return false;
  const snapshot = JSON.parse(JSON.stringify(data));
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("Local cache could not be updated:", error);
  }

  remoteSaveQueue = remoteSaveQueue.then(async () => {
    const { error } = await supabaseClient
      .from(CLOUD_TABLE)
      .upsert({ user_id: userId, payload: snapshot }, { onConflict: "user_id" });
    if (error) throw error;
  }).catch((error) => {
    console.error("Cloud save failed:", error);
    const status = $("#toast");
    status.textContent = "Cloud sync failed. Check your connection before closing this page.";
    status.classList.add("show");
    window.setTimeout(() => status.classList.remove("show"), 5000);
  });
  return true;
}

/* =========================================
   UTILITIES
========================================= */

function makeId() {
  return window.crypto?.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(value) {
  if (!value) return "Not specified";

  const date = new Date(value + "T00:00:00");

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function todayString() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isTradingCard(item) {
  return ["pokemon", "sports", "trading"].includes(item.productCategory);
}

function categoryName(item) {
  return CATEGORY_NAMES[item.productCategory] || "Other";
}

function getSaleForItem(itemId) {
  return data.sales.find((sale) => sale.itemId === itemId);
}

function netProceeds(sale) {
  return Number(sale.salePrice || 0) -
    Number(sale.platformFees || 0) -
    Number(sale.shipping || 0) -
    Number(sale.otherCosts || 0);
}

function saleProfit(sale) {
  const item = data.items.find((entry) => entry.id === sale.itemId);

  if (!item) return 0;
  if (item.purchaseCostUnknown) return null;
  return netProceeds(sale) - Number(item.purchaseCost || 0);
}

function pendingTotal() {
  return data.sales
    .filter((sale) => sale.status === "pending")
    .reduce((total, sale) => total + netProceeds(sale), 0);
}

function lifetimeProfit() {
  return data.sales
    .filter((sale) => sale.status === "paid" && saleProfit(sale) !== null)
    .reduce((total, sale) => total + saleProfit(sale), 0);
}

function allocatePaidSaleFunds(sale, item) {
  if (!item || item.purchaseCostUnknown) return;
  const net = netProceeds(sale);
  const cost = Number(item.purchaseCost) || 0;
  const recovered = Math.round(Math.max(0, Math.min(net, cost)) * 100) / 100;
  const profit = Math.max(0, Math.round((net - cost) * 100) / 100);
  const configuredPercent = Number(sale.reinvestmentPercent);
  const reinvestmentPercent = sale.reinvestmentPercent == null ||
    sale.reinvestmentPercent === "" || !Number.isFinite(configuredPercent)
    ? 50
    : Math.max(0, Math.min(100, configuredPercent));
  const reinvestment = Math.round(profit * reinvestmentPercent) / 100;
  const personal = Math.round((profit - reinvestment) * 100) / 100;
  data.funds.capital += recovered;
  data.funds.reinvestment += reinvestment;
  data.funds.personal += personal;
  sale.capitalRecovered = recovered;
  sale.reinvestmentPercent = reinvestmentPercent;
  sale.reinvestmentAdded = reinvestment;
  sale.personalAdded = personal;
  sale.fundsAllocated = true;
}

/* =========================================
   CATEGORIES
========================================= */

function updateCategoryOptions() {
  const productSelect = $("#productCategory");
  const filterSelect = $("#categoryFilter");

  const previousProduct = productSelect.value;
  const previousFilter = filterSelect.value;

  productSelect.innerHTML = "";
  filterSelect.innerHTML = '<option value="all">All categories</option>';

  Object.entries(CATEGORY_NAMES).forEach(([id, name]) => {
    productSelect.add(new Option(name, id));
    filterSelect.add(new Option(name, id));
  });

  productSelect.add(
    new Option("+ Create custom category…", "__add_custom__")
  );

  if ([...productSelect.options].some(
    (option) => option.value === previousProduct
  )) {
    productSelect.value = previousProduct;
  }

  if ([...filterSelect.options].some(
    (option) => option.value === previousFilter
  )) {
    filterSelect.value = previousFilter;
  }
}

function createCustomCategory() {
  const name = prompt("Enter the name of your new category:");

  if (name === null) return;

  const cleanedName = name.trim();

  if (!cleanedName) {
    alert("Please enter a category name.");
    return;
  }

  if (Object.values(CATEGORY_NAMES).some(
    (existing) => existing.toLowerCase() === cleanedName.toLowerCase()
  )) {
    alert("That category already exists.");
    return;
  }

  const id = "custom_" +
    makeId().replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);

  data.customCategories.push({ id, name: cleanedName });
  CATEGORY_NAMES[id] = cleanedName;

  if (!saveData()) {
    data.customCategories = data.customCategories.filter(
      (entry) => entry.id !== id
    );

    delete CATEGORY_NAMES[id];
    return;
  }

  updateCategoryOptions();
  $("#productCategory").value = id;

  setCardFieldsVisibility();
  renderAll();
}

function setConditionOptions(selectedValue) {
  const select = $("#itemCondition");
  const previous = selectedValue ?? select.value;

  const conditions = $("#productCategory").value === "pokemon"
    ? POKEMON_CONDITIONS
    : STANDARD_CONDITIONS;

  select.innerHTML = "";

  conditions.forEach((condition) => {
    select.add(new Option(condition, condition));
  });

  if (previous && !conditions.includes(previous)) {
    select.add(new Option(previous, previous));
  }

  select.value = previous && [...select.options].some(
    (option) => option.value === previous
  ) ? previous : "Not specified";
}

function setCardFieldsVisibility() {
  const category = $("#productCategory").value;

  const showCardFields = [
    "pokemon", "sports", "trading"
  ].includes(category);

  $("#cardFields").style.display =
    showCardFields ? "block" : "none";

  setConditionOptions();
  setGradingFieldsVisibility();
}

function setGradingFieldsVisibility() {
  const isCard = [
    "pokemon", "sports", "trading"
  ].includes($("#productCategory").value);

  $("#gradingFields").style.display =
    isCard && $("#cardType").value === "graded"
      ? "grid"
      : "none";
}

/* =========================================
   DASHBOARD STATISTICS
========================================= */

function updateDashboard() {
  const unsoldItems = data.items.filter(
    (item) => !getSaleForItem(item.id)
  );

  const soldItems = data.sales.filter(
    (sale) => sale.status === "paid"
  );

  const pendingSales = data.sales.filter(
    (sale) => sale.status === "pending"
  );

  const inventoryValue = unsoldItems.reduce(
    (total, item) => total + Number(item.listedPrice || 0),
    0
  );

  const salesRevenue = data.sales.reduce(
    (total, sale) => total + Number(sale.salePrice || 0),
    0
  );

  const lifetimeInventorySpend = data.items.reduce(
    (total, item) => total + Number(item.purchaseCost || 0),
    0
  );

  $("#capitalValue").textContent = money(lifetimeInventorySpend);
  $("#reinvestmentValue").textContent = money(data.funds.reinvestment);
  $("#personalValue").textContent = money(data.funds.personal);
  $("#pendingValue").textContent = money(pendingTotal());
  $("#lifetimeProfitValue").textContent = money(lifetimeProfit());

  $("#sidebarProfit").textContent = money(lifetimeProfit());

  $("#inStockCount").textContent = unsoldItems.length;
  $("#soldCount").textContent = soldItems.length;
  $("#pendingCount").textContent = pendingSales.length;

  $("#inventoryStatusTotal").textContent =
    `${data.items.length} total items`;

  $("#totalInventoryValue").textContent = unsoldItems.length;
  $("#inventoryValue").textContent = money(inventoryValue);

  $("#salesOverviewTotal").textContent = money(salesRevenue);

  renderSalesChart();
  renderCategoryBreakdown();
  renderRecentActivity();
  renderFinancialReports();
}

function renderFinancialReports() {
  const byMonth = new Map();
  const byCategory = new Map();
  data.sales.forEach((sale) => {
    const month = String(sale.saleDate || sale.createdAt || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    const item = data.items.find((entry) => entry.id === sale.itemId);
    const row = byMonth.get(month) || { revenue: 0, costs: 0, net: 0, inventory: 0, profit: 0, unknownCosts: 0 };
    const net = netProceeds(sale);
    const inventory = Number(item?.purchaseCost || 0);
    row.revenue += Number(sale.salePrice || 0);
    row.costs += Number(sale.platformFees || 0) + Number(sale.shipping || 0) + Number(sale.otherCosts || 0);
    row.net += net;
    const profit = sale.status === "paid" ? saleProfit(sale) : null;
    if (profit !== null) {
      row.inventory += inventory;
      row.profit += profit;
    } else if (sale.status === "paid") {
      row.unknownCosts += 1;
    }
    byMonth.set(month, row);

    if (sale.status === "paid") {
      const category = item ? categoryName(item) : "Other";
      const categoryRow = byCategory.get(category) || { sales: 0, profit: 0, count: 0, unknownCosts: 0 };
      categoryRow.sales += Number(sale.salePrice || 0);
      categoryRow.count += 1;
      if (profit === null) categoryRow.unknownCosts += 1;
      else categoryRow.profit += profit;
      byCategory.set(category, categoryRow);
    }
  });

  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  $("#monthlyReport").innerHTML = months.length ? `
    <table class="report-table"><thead><tr><th>Month</th><th>Sales</th><th>Fees & costs</th><th>Net proceeds</th><th>Inventory cost</th><th>Realized profit</th><th>Cost unknown</th></tr></thead>
    <tbody>${months.map(([month, row]) => `<tr><th>${escapeHtml(new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" }))}</th><td>${money(row.revenue)}</td><td>${money(row.costs)}</td><td>${money(row.net)}</td><td>${money(row.inventory)}</td><td>${money(row.profit)}</td><td>${row.unknownCosts}</td></tr>`).join("")}</tbody></table>`
    : '<p class="muted-text">Record a sale to see monthly performance.</p>';

  const categories = [...byCategory.entries()].sort((a, b) => b[1].profit - a[1].profit);
  $("#categoryProfitReport").innerHTML = categories.length ? `
    <table class="report-table"><thead><tr><th>Category</th><th>Paid sales</th><th>Gross revenue</th><th>Realized profit</th><th>Cost unknown</th></tr></thead>
    <tbody>${categories.map(([category, row]) => `<tr><th>${escapeHtml(category)}</th><td>${row.count}</td><td>${money(row.sales)}</td><td>${money(row.profit)}</td><td>${row.unknownCosts}</td></tr>`).join("")}</tbody></table>`
    : '<p class="muted-text">Paid sales by category will appear here.</p>';
}

function downloadFile(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportSalesCsv() {
  const headers = ["Item", "Category", "Sale date", "Sale date source", "Status", "Sale price", "Platform fees", "Shipping", "Other costs", "Net proceeds", "Purchase cost", "Realized profit"];
  const rows = data.sales.map((sale) => {
    const item = data.items.find((entry) => entry.id === sale.itemId);
    const saleDateSource = sale.saleDateEstimated
      ? `Estimated from eBay report through ${sale.saleReportEndDate || sale.saleDate}`
      : "Recorded sale date";
    return [item?.name || "", item ? categoryName(item) : "Other", sale.saleDate, saleDateSource, sale.status,
      sale.salePrice, sale.platformFees, sale.shipping, sale.otherCosts, netProceeds(sale),
      item?.purchaseCost || 0, sale.status === "paid" && saleProfit(sale) !== null ? saleProfit(sale) : ""];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadFile(`cache-sales-${todayString()}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read a backed-up photo."));
    reader.readAsDataURL(blob);
  });
}

async function createBackup() {
  const backupData = JSON.parse(JSON.stringify(data));
  for (const item of backupData.items) {
    if (!item.photo || item.photo.startsWith("data:")) continue;
    const { data: photo, error } = await supabaseClient.storage.from(PHOTO_BUCKET).download(item.photo);
    if (error) throw error;
    item.photo = await blobToDataUrl(photo);
  }
  downloadFile(`cache-backup-${todayString()}.json`, JSON.stringify({ app: "CACHE", version: 1, exportedAt: new Date().toISOString(), data: backupData }, null, 2), "application/json");
}

function isValidBackup(value) {
  return value && typeof value === "object" && value.data &&
    Array.isArray(value.data.items) && Array.isArray(value.data.sales) &&
    (value.version === 1 || value.version === undefined);
}

async function restoreBackup(event) {
  const file = event.currentTarget.files[0];
  event.currentTarget.value = "";
  if (!file) return;
  const message = $("#backupMessage");
  try {
    const backup = JSON.parse(await file.text());
    if (!isValidBackup(backup)) throw new Error("This file is not a CACHE backup.");
    if (!confirm("Replace all current inventory, sales, categories, and funds with this backup? This cannot be undone.")) return;

    const restored = normalizeData(backup.data);
    for (const item of restored.items) {
      if (typeof item.photo !== "string" || !item.photo.startsWith("data:image/")) continue;
      item.photo = await uploadEmbeddedPhoto(item.photo, item.id);
    }
    data = restored;
    Object.keys(CATEGORY_NAMES).filter((id) => id.startsWith("custom_")).forEach((id) => delete CATEGORY_NAMES[id]);
    applyCustomCategoryNames();
    updateCategoryOptions();
    if (!saveData()) throw new Error("Could not save the restored data.");
    renderAll();
    message.textContent = "Backup restored. Cloud sync is in progress.";
    message.classList.remove("error");
  } catch (error) {
    console.error("Could not restore backup:", error);
    message.textContent = error.message || "Could not restore this backup.";
    message.classList.add("error");
  }
}

function setupDataTools() {
  $("#exportCsvButton").addEventListener("click", exportSalesCsv);
  $("#backupButton").addEventListener("click", async () => {
    const message = $("#backupMessage");
    message.textContent = "Preparing backup…";
    try {
      await createBackup();
      message.textContent = "Backup downloaded.";
      message.classList.remove("error");
    } catch (error) {
      console.error("Could not create backup:", error);
      message.textContent = "Could not download all backup data. Check your connection and try again.";
      message.classList.add("error");
    }
  });
  $("#restoreButton").addEventListener("click", () => $("#restoreFile").click());
  $("#restoreFile").addEventListener("change", restoreBackup);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizeCsvHeader(value) {
  return String(value || "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findCsvColumn(headers, aliases) {
  return headers.findIndex((header) => {
    const normalized = normalizeCsvHeader(header);
    return aliases.some((alias) => normalized === alias || (alias !== "item" && normalized.startsWith(alias)));
  });
}

function parseCsvMoney(value) {
  const text = String(value || "").trim();
  if (!text || /^[-–—]+$/.test(text)) return null;
  const parenthesized = /^\(.*\)$/.test(text);
  const number = Number(text.replace(/[,$\s()]/g, "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(number)) return null;
  return parenthesized ? -Math.abs(number) : number;
}

function parseCsvDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const validatedDate = (year, month, day) => {
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return validatedDate(iso[1], iso[2], iso[3]);
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (us) {
    const year = us[3].length === 2 ? Number(us[3]) + (Number(us[3]) < 70 ? 2000 : 1900) : Number(us[3]);
    return validatedDate(year, us[1], us[2]);
  }
  const english = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (english) {
    const monthNumber = new Date(english[1] + " 1, 2000").getMonth() + 1;
    if (monthNumber >= 1 && monthNumber <= 12) {
      return validatedDate(english[3], monthNumber, english[2]);
    }
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ebayRowKey(parts) {
  const source = parts.map((part) => String(part || "").trim().toLowerCase()).join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ebay-${(hash >>> 0).toString(16)}`;
}

function splitCsvAmount(value, quantity) {
  const cents = Math.round((Number(value) || 0) * 100);
  const sign = cents < 0 ? -1 : 1;
  const absoluteCents = Math.abs(cents);
  const baseCents = Math.floor(absoluteCents / quantity);
  const extraCents = absoluteCents % quantity;
  return Array.from({ length: quantity }, (_, index) =>
    sign * (baseCents + (index < extraCents ? 1 : 0)) / 100
  );
}

function parseEbayCsv(text) {
  const rows = parseCsv(text);
  const reportLabel = rows.flat().find((cell) => /^\s*Report for\s+/i.test(cell)) || "";
  const reportDateMatch = reportLabel.match(/^\s*Report for\s+(.+?)\s+to\s+(.+?)\s*$/i);
  const reportStartDate = reportDateMatch ? parseCsvDate(reportDateMatch[1]) : "";
  const reportEndDate = reportDateMatch ? parseCsvDate(reportDateMatch[2]) : "";
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeCsvHeader);
    const hasTitle = headers.some((value) => ["itemtitle", "title", "item", "listingtitle"].some((alias) => value === alias || (alias !== "item" && value.startsWith(alias))));
    const hasTransactionPrice = headers.some((value) => ["soldfor", "saleprice", "itemprice", "price", "itemsaleprice", "itemsoldfor", "saleamount", "grossamount"].some((alias) => value === alias || value.startsWith(alias)));
    const hasListingReportFields = headers.includes("itemsales") && headers.includes("quantitysold") && headers.includes("totalsellingcosts");
    return hasTitle && (hasTransactionPrice || hasListingReportFields);
  });
  if (headerIndex < 0) throw new Error("I couldn't find the item title and sale price columns. Choose an eBay orders or sales CSV.");

  const headers = rows[headerIndex];
  const titleColumn = findCsvColumn(headers, ["itemtitle", "listingtitle", "title", "item"]);
  const skuColumn = findCsvColumn(headers, ["customlabelsku", "customlabel", "sku"]);
  const itemSalesColumn = findCsvColumn(headers, ["itemsales"]);
  const quantityColumn = findCsvColumn(headers, ["quantitysold"]);
  const totalSellingCostsColumn = findCsvColumn(headers, ["totalsellingcosts"]);
  const listingReport = itemSalesColumn >= 0 && quantityColumn >= 0 && totalSellingCostsColumn >= 0;
  if (listingReport && (!reportStartDate || !reportEndDate)) {
    throw new Error("This eBay listings report is missing its report date range, so sales can't be backdated safely.");
  }
  const priceColumn = listingReport ? itemSalesColumn : findCsvColumn(headers, ["soldfor", "saleprice", "itemsoldfor", "itemsaleprice", "itemprice", "itemsaleamount", "saleamount", "grossamount", "price"]);
  const dateColumn = findCsvColumn(headers, ["ordercreationdate", "dateofsale", "saledate", "datesold", "orderdate", "creationdate", "date"]);
  const statusColumn = findCsvColumn(headers, ["paymentstatus", "orderstatus", "status"]);
  const listingIdColumn = findCsvColumn(headers, ["ebayitemid", "listingid"]);
  const shippingRevenueColumn = findCsvColumn(headers, ["shippingandhandlingpaidbybuyertoyou"]);
  const shippingLabelCostColumn = findCsvColumn(headers, ["shippinglabelscost"]);
  const idColumns = ["salesrecordnumber", "ordernumber", "orderid", "transactionid", "itemnumber", "ebayitemid"]
    .map((alias) => findCsvColumn(headers, [alias])).filter((index) => index >= 0);
  const feeColumns = headers.map((header, index) => ({ name: normalizeCsvHeader(header), index }))
    .filter(({ name }) => name.includes("fee") && !name.includes("refund") && !name.includes("tax"))
    .map(({ index }) => index);
  const inventoryBySku = data.items.filter((item) => item.sku).reduce((map, item) => {
    const key = item.sku.trim().toLowerCase();
    map.set(key, [...(map.get(key) || []), item]);
    return map;
  }, new Map());
  const titleKey = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const seenKeys = new Set();
  const reservedItemIds = new Set();
  const importedKeys = new Set(data.sales.filter((sale) => sale.source === "ebay").map((sale) => sale.externalId));

  return rows.slice(headerIndex + 1).flatMap((cells, offset) => {
    const value = (column) => column < 0 ? "" : (cells[column] || "").trim();
    const title = value(titleColumn);
    const itemSales = parseCsvMoney(value(priceColumn));
    const date = listingReport ? reportEndDate : parseCsvDate(value(dateColumn));
    const sku = value(skuColumn);
    if (!title) return [];
    const statusText = value(statusColumn).toLowerCase();
    const identity = idColumns.map(value).filter(Boolean);
    const listingId = value(listingIdColumn);
    const quantityValue = listingReport ? Number.parseInt(value(quantityColumn), 10) : 1;
    const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? Math.min(quantityValue, 1000) : 1;
    const shippingRevenue = listingReport ? (parseCsvMoney(value(shippingRevenueColumn)) || 0) : 0;
    const shippingLabelCost = listingReport ? (parseCsvMoney(value(shippingLabelCostColumn)) || 0) : 0;
    const reportCosts = listingReport ? parseCsvMoney(value(totalSellingCostsColumn)) : null;
    const aggregateFees = listingReport && reportCosts !== null
      ? reportCosts - shippingLabelCost
      : feeColumns.reduce((total, column) => total + Math.abs(parseCsvMoney(value(column)) || 0), 0);
    const itemSalesParts = listingReport && itemSales !== null ? splitCsvAmount(itemSales, quantity) : [];
    const shippingRevenueParts = listingReport ? splitCsvAmount(shippingRevenue, quantity) : [];
    const feeParts = listingReport ? splitCsvAmount(aggregateFees, quantity) : [];
    const shippingCostParts = listingReport ? splitCsvAmount(shippingLabelCost, quantity) : [];
    const candidatesByListingId = listingId
      ? data.items.filter((item) => String(item.ebayItemId || "") === listingId)
      : [];
    const skuCandidates = sku ? (inventoryBySku.get(sku.toLowerCase()) || []) : [];
    const titleCandidates = data.items.filter((item) => titleKey(item.name) === titleKey(title));
    const namedCandidates = candidatesByListingId.length
      ? candidatesByListingId
      : (skuCandidates.length ? skuCandidates : titleCandidates);
    const existingSoldCount = namedCandidates.filter((item) => getSaleForItem(item.id)).length;
    const copies = [];

    for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
      const unitIdentity = listingReport
        ? [listingId || title, reportStartDate, reportEndDate, unitIndex + 1]
        : [...identity, sku, title, date, itemSales, identity.length ? "" : offset];
      const importKey = ebayRowKey(unitIdentity);
      const availableItem = namedCandidates.find((item) => !getSaleForItem(item.id) && !reservedItemIds.has(item.id));
      if (availableItem) reservedItemIds.add(availableItem.id);
      const priorSale = listingReport
        ? (!availableItem && unitIndex < existingSoldCount)
        : (namedCandidates.length > 0 && !availableItem);
      const repeatedInFile = seenKeys.has(importKey);
      seenKeys.add(importKey);

      let state = "ready";
      if (importedKeys.has(importKey) || repeatedInFile) state = "duplicate";
      else if (/cancel|refund|void/.test(statusText)) state = "cancelled";
      else if (!date || itemSales === null || (listingReport && (reportCosts === null || !Number.isFinite(quantityValue) || quantityValue < 1 || quantityValue > 1000))) state = "invalid";
      else if (priorSale) state = "already-sold";

      copies.push({
        rowNumber: headerIndex + offset + 2,
        title,
        sku,
        listingId,
        date,
        dateEstimated: listingReport,
        reportStartDate,
        reportEndDate,
        unitIndex: unitIndex + 1,
        unitCount: quantity,
        price: listingReport
          ? Math.round(((itemSalesParts[unitIndex] || 0) + (shippingRevenueParts[unitIndex] || 0)) * 100) / 100
          : itemSales,
        fees: listingReport ? (feeParts[unitIndex] || 0) : aggregateFees,
        shipping: listingReport ? (shippingCostParts[unitIndex] || 0) : 0,
        purchaseCost: availableItem && !availableItem.purchaseCostUnknown
          ? Number(availableItem.purchaseCost) || 0
          : "",
        reinvestmentPercent: 50,
        status: /unpaid|awaitingpayment|paymentpending/.test(normalizeCsvHeader(statusText)) ? "pending" : "paid",
        importKey,
        matchedItemId: availableItem?.id || "",
        state,
        include: state === "ready"
      });
    }
    return copies;
  });
}

function renderEbayPreview() {
  const rows = ebayImportRows;
  const hasCost = (row) => row.purchaseCost !== "" && row.purchaseCost != null &&
    Number.isFinite(Number(row.purchaseCost)) && Number(row.purchaseCost) >= 0;
  const stateLabel = (row) => ({
    ready: row.matchedItemId
      ? `Match: ${data.items.find((item) => item.id === row.matchedItemId)?.name || "inventory"}${hasCost(row) ? "" : " · cost unknown"}`
      : (hasCost(row) ? "Add sold item" : "Add sold item; cost unknown"),
    duplicate: "Already imported",
    cancelled: "Cancelled/refunded; skipped",
    invalid: "Missing sale price or date",
    "already-sold": "Matching item already has a sale",
    imported: "Imported"
  })[row.state] || "Skipped";
  const selectable = rows.filter((row) => row.state === "ready");
  const selected = selectable.filter((row) => row.include).length;
  $("#ebayPreview").innerHTML = rows.length ? `
    <table class="report-table ebay-preview-table">
      <thead><tr><th><input type="checkbox" data-ebay-select-all aria-label="Select importable rows" ${selectable.length && selected === selectable.length ? "checked" : ""} ${selectable.length ? "" : "disabled"}></th><th>Item</th><th>Sale date</th><th>Price</th><th>Bought cost</th><th>Fees</th><th>Shipping cost</th><th>Profit split</th><th>Import action</th></tr></thead>
      <tbody>${rows.map((row, index) => `<tr><td><input type="checkbox" data-ebay-row="${index}" aria-label="Select ${escapeHtml(row.title)}" ${row.include ? "checked" : ""} ${row.state === "ready" ? "" : "disabled"}></td><td>${escapeHtml(row.title)}${row.sku ? `<small class="import-sku">SKU ${escapeHtml(row.sku)}</small>` : ""}${row.listingId ? `<small class="import-sku">eBay listing ${escapeHtml(row.listingId)}</small>` : ""}${row.unitCount > 1 ? `<small class="import-sku">Copy ${row.unitIndex} of ${row.unitCount}</small>` : ""}</td><td>${escapeHtml(row.date || "—")}${row.dateEstimated ? '<small class="import-sku">Report end date</small>' : ""}</td><td>${row.price === null ? "—" : money(row.price)}</td><td><input class="ebay-cost-input" type="number" min="0" step="0.01" placeholder="Unknown" aria-label="Bought cost for ${escapeHtml(row.title)}" data-ebay-cost="${index}" value="${hasCost(row) ? escapeHtml(row.purchaseCost) : ""}" ${row.state === "ready" ? "" : "disabled"}></td><td>${money(row.fees)}</td><td>${money(row.shipping)}</td><td><div class="ebay-split-control"><input type="range" min="0" max="100" step="1" aria-label="Reinvestment percentage for ${escapeHtml(row.title)}" data-ebay-percent="${index}" value="${row.reinvestmentPercent ?? 50}" ${row.state === "ready" ? "" : "disabled"}><small data-ebay-percent-label="${index}">${row.reinvestmentPercent ?? 50}% reinvest · ${100 - (row.reinvestmentPercent ?? 50)}% personal</small></div></td><td data-ebay-action-label="${index}">${escapeHtml(stateLabel(row))}</td></tr>`).join("")}</tbody>
    </table>` : "";
  const skipped = rows.length - selectable.length;
  const dateNote = rows.some((row) => row.dateEstimated)
    ? ` The report has no individual sale dates; each sale is dated to the report end (${formatDate(rows.find((row) => row.dateEstimated).reportEndDate)}).`
    : "";
  $("#ebayImportSummary").textContent = rows.length
    ? `${rows.length} sale rows found · ${selected} selected · ${skipped} skipped or already imported. Buyer names, addresses, and emails are ignored.${dateNote}`
    : "";
  $("#importEbayButton").disabled = selected === 0;
  $("#cancelEbayImportButton").hidden = rows.length === 0;
}

async function previewEbayCsv(event) {
  const file = event.currentTarget.files[0];
  if (!file) return;
  try {
    ebayImportRows = parseEbayCsv(await file.text());
    $("#ebayImportSummary").classList.remove("error");
    renderEbayPreview();
  } catch (error) {
    ebayImportRows = [];
    renderEbayPreview();
    $("#ebayImportSummary").textContent = error.message || "Could not read this CSV.";
    $("#ebayImportSummary").classList.add("error");
  }
}

function updateEbaySelection() {
  $("#ebayPreview").querySelectorAll("[data-ebay-row]").forEach((checkbox) => {
    ebayImportRows[Number(checkbox.dataset.ebayRow)].include = checkbox.checked;
  });
  renderEbayPreview();
}

function updateEbayPreviewInputs(event) {
  const target = event.target;
  const rowIndex = Number(target.dataset.ebayCost ?? target.dataset.ebayPercent);
  const row = ebayImportRows[rowIndex];
  if (!row) return;

  if (target.matches("[data-ebay-cost]")) {
    row.purchaseCost = target.value === "" ? "" : Number(target.value);
    const actionLabel = $("#ebayPreview").querySelector(`[data-ebay-action-label="${rowIndex}"]`);
    if (actionLabel && row.state === "ready") {
      const hasCost = row.purchaseCost !== "" && Number.isFinite(Number(row.purchaseCost)) && Number(row.purchaseCost) >= 0;
      const matchedItem = data.items.find((item) => item.id === row.matchedItemId);
      actionLabel.textContent = matchedItem
        ? `Match: ${matchedItem.name}${hasCost ? "" : " · cost unknown"}`
        : (hasCost ? "Add sold item" : "Add sold item; cost unknown");
    }
    return;
  }
  if (target.matches("[data-ebay-percent]")) {
    row.reinvestmentPercent = Math.max(0, Math.min(100, Number(target.value) || 0));
    const label = $("#ebayPreview").querySelector(`[data-ebay-percent-label="${rowIndex}"]`);
    if (label) label.textContent = `${row.reinvestmentPercent}% reinvest · ${100 - row.reinvestmentPercent}% personal`;
  }
}

function importSelectedEbaySales() {
  const selected = ebayImportRows.filter((row) => row.state === "ready" && row.include);
  if (!selected.length) return;
  if (selected.some((row) => row.purchaseCost !== "" && row.purchaseCost != null &&
      (!Number.isFinite(Number(row.purchaseCost)) || Number(row.purchaseCost) < 0))) {
    $("#ebayImportSummary").textContent = "Enter a valid nonnegative bought cost for each selected sale, or leave it blank.";
    $("#ebayImportSummary").classList.add("error");
    return;
  }
  const previousData = JSON.parse(JSON.stringify(data));
  try {
    for (const row of selected) {
      let item = row.matchedItemId
        ? data.items.find((entry) => entry.id === row.matchedItemId)
        : null;
      if (item && getSaleForItem(item.id)) {
        row.state = "already-sold";
        row.include = false;
        continue;
      }
      if (!item) {
        const purchaseCostKnown = row.purchaseCost !== "" && row.purchaseCost != null;
        item = {
          id: makeId(),
          name: row.title,
          sku: row.sku,
          ebayItemId: row.listingId || "",
          productCategory: "other",
          listedPrice: row.price,
          purchaseCost: purchaseCostKnown ? Math.round(Number(row.purchaseCost) * 100) / 100 : 0,
          purchaseCostUnknown: !purchaseCostKnown,
          purchaseDate: row.dateEstimated ? "" : row.date,
          itemCondition: "Not specified",
          photo: "",
          notes: purchaseCostKnown
            ? "Imported from eBay."
            : "Imported from eBay. Add the purchase cost to calculate profit accurately.",
          createdAt: new Date().toISOString()
        };
        data.items.push(item);
      }
      if (item && row.listingId && !item.ebayItemId) item.ebayItemId = row.listingId;
      if (row.purchaseCost !== "" && row.purchaseCost != null) {
        item.purchaseCost = Math.round(Number(row.purchaseCost) * 100) / 100;
        item.purchaseCostUnknown = false;
      } else {
        item.purchaseCostUnknown = true;
      }
      const sale = {
        id: makeId(),
        itemId: item.id,
        salePrice: row.price,
        platformFees: row.fees,
        shipping: row.shipping || 0,
        otherCosts: 0,
        saleDate: row.date,
        saleDateEstimated: Boolean(row.dateEstimated),
        saleReportStartDate: row.dateEstimated ? row.reportStartDate : "",
        saleReportEndDate: row.dateEstimated ? row.reportEndDate : "",
        reinvestmentPercent: Math.max(0, Math.min(100, Number(row.reinvestmentPercent ?? 50))),
        status: row.status,
        createdAt: new Date().toISOString(),
        source: "ebay",
        externalId: row.importKey,
        fundsAllocated: false
      };
      if (sale.status === "paid") {
        sale.paidDate = row.date;
        sale.paidAt = new Date(`${row.date}T12:00:00`).toISOString();
        allocatePaidSaleFunds(sale, item);
      }
      data.sales.push(sale);
      row.state = "imported";
      row.include = false;
    }
    if (!saveData()) throw new Error("Could not save the imported sales.");
    renderAll();
    renderEbayPreview();
  } catch (error) {
    data = normalizeData(previousData);
    selected.forEach((row) => {
      if (row.state === "imported") {
        row.state = "ready";
        row.include = true;
      }
    });
    console.error("eBay import failed:", error);
    $("#ebayImportSummary").textContent = error.message || "Could not import these sales.";
    $("#ebayImportSummary").classList.add("error");
    renderAll();
  }
}

function setupEbayImport() {
  $("#ebayCsvFile").addEventListener("change", previewEbayCsv);
  $("#ebayPreview").addEventListener("input", updateEbayPreviewInputs);
  $("#ebayPreview").addEventListener("change", (event) => {
    if (event.target.matches("[data-ebay-row]")) updateEbaySelection();
    if (event.target.matches("[data-ebay-select-all]")) {
      ebayImportRows.forEach((row) => {
        if (row.state === "ready") row.include = event.target.checked;
      });
      renderEbayPreview();
    }
  });
  $("#importEbayButton").addEventListener("click", importSelectedEbaySales);
  $("#cancelEbayImportButton").addEventListener("click", () => {
    ebayImportRows = [];
    $("#ebayCsvFile").value = "";
    renderEbayPreview();
  });
}

/* =========================================
   SALES CHART
========================================= */

function renderSalesChart() {
  const canvas = $("#salesChart");

  if (!canvas || typeof Chart === "undefined") return;

  const monthlySales = {};

  data.sales.forEach((sale) => {
    const dateValue = sale.saleDate || sale.createdAt;

    if (!dateValue) return;

    const date = new Date(dateValue + (dateValue.length === 10 ? "T00:00:00" : ""));

    if (Number.isNaN(date.getTime())) return;

    const key =
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    monthlySales[key] =
      (monthlySales[key] || 0) + Number(sale.salePrice || 0);
  });

  const labels = [];
  const values = [];

  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);

    const key =
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    labels.push(date.toLocaleDateString("en-US", { month: "short" }));
    values.push(monthlySales[key] || 0);
  }

  if (salesChart) {
    salesChart.destroy();
  }

  const context = canvas.getContext("2d");

  const gradient = context.createLinearGradient(0, 0, 0, 240);

  gradient.addColorStop(0, "rgba(239,255,0,0.28)");
  gradient.addColorStop(1, "rgba(239,255,0,0.00)");

  salesChart = new Chart(context, {
    type: "line",

    data: {
      labels,

      datasets: [{
        label: "Sales revenue",
        data: values,

        borderColor: "#efff00",
        backgroundColor: gradient,

        borderWidth: 2.5,
        fill: true,

        tension: 0.4,

        pointRadius: 3,
        pointHoverRadius: 6,

        pointBackgroundColor: "#efff00",
        pointBorderColor: "#101010",
        pointBorderWidth: 2
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: false
        },

        tooltip: {
          backgroundColor: "#242729",
          titleColor: "#ffffff",
          bodyColor: "#efff00",
          borderColor: "#414447",
          borderWidth: 1,

          callbacks: {
            label: (context) => money(context.raw)
          }
        }
      },

      scales: {
        x: {
          grid: {
            color: "rgba(255,255,255,0.05)",
            drawBorder: false
          },

          ticks: {
            color: "#92969b",
            font: {
              size: 10
            }
          }
        },

        y: {
          beginAtZero: true,

          grid: {
            color: "rgba(255,255,255,0.07)",
            drawBorder: false
          },

          ticks: {
            color: "#92969b",
            font: {
              size: 10
            },

            callback: (value) => {
              if (value >= 1000) {
                return "$" + (value / 1000).toFixed(1) + "k";
              }

              return "$" + value;
            }
          }
        }
      }
    }
  });
}

/* =========================================
   CATEGORY BREAKDOWN
========================================= */

function renderCategoryBreakdown() {
  const donut = $("#categoryDonut");
  const legend = $("#categoryLegend");

  if (!donut || !legend) return;

  const counts = {};

  data.items
    .filter((item) => !getSaleForItem(item.id))
    .forEach((item) => {
      const category = item.productCategory || "other";

      counts[category] = (counts[category] || 0) + 1;
    });

  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]);

  const total = entries.reduce(
    (sum, entry) => sum + entry[1],
    0
  );

  $("#categoryTotal").textContent = total;

  if (!total) {
    donut.style.background =
      "conic-gradient(#303438 0deg 360deg)";

    legend.innerHTML = `
      <p class="muted-text">
        Add inventory to see your category breakdown.
      </p>`;

    return;
  }

  let currentAngle = 0;
  const segments = [];

  entries.forEach(([category, count], index) => {
    const angle = (count / total) * 360;
    const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

    segments.push(
      `${color} ${currentAngle}deg ${currentAngle + angle}deg`
    );

    currentAngle += angle;
  });

  donut.style.background =
    `conic-gradient(${segments.join(", ")})`;

  legend.innerHTML = entries.slice(0, 6).map(
    ([category, count], index) => {
      const percentage = Math.round((count / total) * 100);
      const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

      return `
        <div class="category-legend-row">

          <span class="category-color"
            style="background:${color}"></span>

          <span class="category-name">
            ${escapeHtml(CATEGORY_NAMES[category] || "Other")}
          </span>

          <span class="category-count">${count}</span>

          <span class="category-percent">${percentage}%</span>

        </div>`;
    }
  ).join("");
}

/* =========================================
   RECENT ACTIVITY
========================================= */

function relativeTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const difference = Math.max(0, Date.now() - date.getTime());

  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;

  return formatDate(value.slice(0, 10));
}

function renderRecentActivity() {
  const container = $("#recentActivity");

  if (!container) return;

  const activities = [];

  data.items.forEach((item) => {
    activities.push({
      title: "Item added",
      description: item.name,
      date: item.createdAt || item.purchaseDate,
      type: "added",
      icon: "+"
    });
  });

  data.sales.forEach((sale) => {
    const item = data.items.find(
      (entry) => entry.id === sale.itemId
    );

    const name = item ? item.name : "Inventory item";

    activities.push({
      title: sale.status === "paid"
        ? "Sale marked as paid"
        : "Sale recorded",

      description: name,

      date: sale.paidAt || sale.createdAt || sale.saleDate,

      type: sale.status === "paid" ? "paid" : "sale",

      icon: sale.status === "paid" ? "✓" : "$"
    });
  });

  activities.sort((a, b) =>
    new Date(b.date || 0) - new Date(a.date || 0)
  );

  const recent = activities.slice(0, 5);

  if (!recent.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No activity yet</h3>
        <p>Your inventory and sales activity will appear here.</p>
      </div>`;

    return;
  }

  container.innerHTML = recent.map((activity) => `
    <div class="activity-item">

      <div class="activity-icon ${
        activity.type === "paid" ? "paid" :
        activity.type === "added" ? "" : "updated"
      }">
        ${activity.icon}
      </div>

      <div class="activity-main">
        <strong>${escapeHtml(activity.title)}</strong>
        <span>${escapeHtml(activity.description)}</span>
      </div>

      <span class="activity-time">
        ${escapeHtml(relativeTime(activity.date))}
      </span>

    </div>
  `).join("");
}

/* =========================================
   EMPTY STATES AND INVENTORY DISPLAY
========================================= */

function emptyState(title, description, buttonText, page) {
  return `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>

      ${buttonText && page ? `
        <button class="primary-button" type="button"
          data-go="${escapeHtml(page)}"
          style="margin-top:16px">
          ${escapeHtml(buttonText)}
        </button>
      ` : ""}
    </div>`;
}

function itemIcon(item) {
  if (isTradingCard(item)) return "▤";

  return ({
    videogames: "▣",
    electronics: "⌘",
    clothing: "◇",
    collectibles: "✧"
  })[item.productCategory] || "□";
}

function thumbnail(item) {
  if (item.photo) {
    const embeddedPhoto = item.photo.startsWith("data:");
    return `
      <div class="item-thumbnail">
        <img ${embeddedPhoto ? `src="${escapeHtml(item.photo)}"` : `data-photo-path="${escapeHtml(item.photo)}"`}
          alt="" loading="lazy">
      </div>`;
  }

  return `
    <div class="item-thumbnail" aria-hidden="true">
      ${itemIcon(item)}
    </div>`;
}

function itemRow(item) {
  const sale = getSaleForItem(item.id);

  const status = sale
    ? sale.status === "paid"
      ? "Sold"
      : "Pending payout"
    : "Available";

  return `
    <article class="item-row">

      ${thumbnail(item)}

      <div class="item-main">

        <div class="item-title">
          ${escapeHtml(item.name)}
        </div>

        <div class="item-meta">
          <span>${escapeHtml(categoryName(item))}</span>
          <span>${escapeHtml(item.itemCondition || "Not specified")}</span>
          <span>${escapeHtml(formatDate(item.purchaseDate))}</span>
        </div>

        <div style="margin-top:7px">
          <span class="status-pill ${
            sale?.status === "pending" ? "pending" :
            sale?.status === "paid" ? "paid" : ""
          }">${status}</span>
        </div>

      </div>

      <div class="item-price">

        <strong>
          ${money(sale ? netProceeds(sale) : (item.listedPrice || 0))}
        </strong>

        <span>${sale ? "Net proceeds" : "Listed price"}</span>

        <button class="text-button" type="button"
          data-open-item="${escapeHtml(item.id)}">
          Details
        </button>

      </div>

    </article>`;
}

function renderRecentInventory() {
  const items = data.items
    .filter((item) => !getSaleForItem(item.id))
    .sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    )
    .slice(0, 4);

  $("#recentInventory").innerHTML = items.length
    ? items.map(itemRow).join("")
    : emptyState(
      "Your inventory starts here",
      "Add your first item to begin tracking costs and profits.",
      "Add your first item",
      "add"
    );
}

function renderInventory() {
  const query = ($("#inventorySearch").value || "")
    .trim()
    .toLowerCase();

  const category = $("#categoryFilter").value;

  const items = data.items
    .filter((item) => !getSaleForItem(item.id))
    .filter((item) => {
      const matchesText =
        item.name.toLowerCase().includes(query) ||
        (item.notes || "").toLowerCase().includes(query);

      return matchesText &&
        (category === "all" || item.productCategory === category);
    })
    .sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );

  $("#inventoryList").innerHTML = items.length
    ? items.map(itemRow).join("")
    : emptyState(
      "No inventory found",
      "Try a different search or add an item.",
      "Add item",
      "add"
    );
}

function renderPending() {
  const sales = data.sales
    .filter((sale) => sale.status === "pending")
    .sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );

  $("#pendingList").innerHTML = sales.length
    ? sales.map((sale) => {
      const item = data.items.find(
        (entry) => entry.id === sale.itemId
      );

      if (!item) return "";

      return `
        <article class="item-row">

          ${thumbnail(item)}

          <div class="item-main">
            <div class="item-title">
              ${escapeHtml(item.name)}
            </div>

            <div class="item-meta">
              <span>Sale date: ${escapeHtml(formatDate(sale.saleDate))}</span>
              <span class="status-pill pending">Awaiting payout</span>
            </div>
          </div>

          <div class="item-price">
            <strong>${money(netProceeds(sale))}</strong>
            <span>Expected payout</span>

            <button class="text-button" type="button"
              data-open-item="${escapeHtml(item.id)}">
              Details
            </button>
          </div>

        </article>`;
    }).join("")
    : emptyState(
      "No pending payouts",
      "Recorded sales awaiting payment will appear here.",
      "View inventory",
      "inventory"
    );
}

function renderSold() {
  const sales = data.sales
    .filter((sale) => sale.status === "paid")
    .sort((a, b) =>
      (b.paidAt || "").localeCompare(a.paidAt || "")
    );

  $("#soldList").innerHTML = sales.length
    ? sales.map((sale) => {
      const item = data.items.find(
        (entry) => entry.id === sale.itemId
      );

      if (!item) return "";

      return `
        <article class="item-row">

          ${thumbnail(item)}

          <div class="item-main">
            <div class="item-title">
              ${escapeHtml(item.name)}
            </div>

            <div class="item-meta">
              <span>Paid: ${escapeHtml(formatDate(sale.paidDate || sale.saleDate))}</span>
              <span class="status-pill paid">Paid</span>
            </div>
          </div>

          <div class="item-price">
            <strong>${saleProfit(sale) === null ? "Not recorded" : money(saleProfit(sale))}</strong>
            <span>Profit / loss</span>

            <button class="text-button" type="button"
              data-open-item="${escapeHtml(item.id)}">
              Details
            </button>
          </div>

        </article>`;
    }).join("")
    : emptyState(
      "No completed sales yet",
      "Sales marked as paid will appear here.",
      "View pending",
      "pending"
    );
}

function renderAll() {
  updateDashboard();
  renderRecentInventory();
  renderInventory();
  renderPending();
  renderSold();
  hydratePhotos(document);
}

/* =========================================
   NAVIGATION
========================================= */

function showPage(pageName) {
  if (!["home", "inventory", "add", "pending", "sold", "account"].includes(pageName)) {
    return;
  }

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle(
      "active",
      page.id === `page-${pageName}`
    );
  });

  document.querySelectorAll(".nav-button, .sidebar-link, .mobile-account-link").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === pageName
    );
  });

  const titles = {
    home: "Dashboard",
    inventory: "Inventory",
    add: "Add item",
    pending: "Pending payouts",
    sold: "Completed sales",
    account: "Your account"
  };

  const title = $("#currentPageTitle");

  if (title) title.textContent = titles[pageName];

  $("#formMessage").textContent = "";
  $("#formMessage").classList.remove("error");
}

/* =========================================
   PHOTOS
========================================= */

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");

    if (!file.type.startsWith("image/")) {
      return reject(new Error("Please choose an image file."));
    }

    if (file.size > 12 * 1024 * 1024) {
      return reject(new Error("Please choose an image smaller than 12 MB."));
    }

    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);

      const maxDimension = 1280;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Could not process the image."));

      // A white fill keeps transparent PNG/WebP images readable after JPEG conversion.
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Could not process the image."));
        resolve(blob);
      }, "image/jpeg", 0.82);
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Could not read the image."));
    };

    image.src = imageUrl;
  });
}

async function uploadPhotoBlob(blob, itemId) {
  const userId = supabaseUser?.id;
  if (!userId) throw new Error("Sign in before uploading a photo.");
  const path = `${userId}/${itemId}/${makeId()}.jpg`;
  const { error } = await supabaseClient.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false
  });
  if (error) throw error;
  return path;
}

async function migrateEmbeddedPhotos() {
  let migrated = 0;
  for (const item of data.items) {
    if (typeof item.photo !== "string" || !item.photo.startsWith("data:image/")) continue;
    item.photo = await uploadEmbeddedPhoto(item.photo, item.id);
    migrated += 1;
  }
  if (migrated) {
    if (!saveData()) throw new Error("Could not save migrated photo references.");
    renderAll();
  }
  return migrated;
}

async function uploadEmbeddedPhoto(dataUrl, itemId) {
  const source = await (await fetch(dataUrl)).blob();
  const file = new File([source], `item-${itemId}`, { type: source.type || "image/jpeg" });
  return uploadPhotoBlob(await readPhoto(file), itemId);
}

async function hydratePhotos(container) {
  const images = [...container.querySelectorAll("img[data-photo-path]")];
  await Promise.all(images.map(async (image) => {
    const path = image.dataset.photoPath;
    if (!signedPhotoUrls.has(path)) {
      signedPhotoUrls.set(path, { url: "", expiresAt: 0, pending: null });
    }
    const cached = signedPhotoUrls.get(path);
    if (!cached.url || cached.expiresAt < Date.now() + 60000) {
      if (!cached.pending) {
        cached.pending = supabaseClient.storage.from(PHOTO_BUCKET)
          .createSignedUrl(path, 3600)
          .then(({ data: result, error }) => {
            if (error) throw error;
            cached.url = result.signedUrl;
            cached.expiresAt = Date.now() + 3500000;
            return cached.url;
          })
          .catch((error) => {
            console.warn("Could not load item photo:", error);
            return "";
          })
          .finally(() => { cached.pending = null; });
      }
      await cached.pending;
    }
    if (cached.url && image.isConnected && image.dataset.photoPath === path) image.src = cached.url;
  }));
}

/* =========================================
   ADD AND EDIT ITEMS
========================================= */

async function saveItemForm(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const editingId = form.dataset.editingId || null;

  const existing = editingId
    ? data.items.find((item) => item.id === editingId)
    : null;
  const itemId = existing?.id || makeId();

  const message = $("#formMessage");

  message.textContent = "";
  message.classList.remove("error");

  const name = $("#itemName").value.trim();
  const listedPrice = Number($("#listedPrice").value);
  const purchaseCost = Number($("#purchaseCost").value);
  const purchaseDate = $("#purchaseDate").value;

  if (!name || !purchaseDate ||
      (existing?.purchaseCostUnknown && !$("#purchaseCost").value.trim()) ||
      !Number.isFinite(listedPrice) || listedPrice < 0 ||
      !Number.isFinite(purchaseCost) || purchaseCost < 0) {
    message.textContent =
      "Enter a name, valid listed price, purchase cost, and date.";

    message.classList.add("error");
    return;
  }

  const button = form.querySelector('[type="submit"]');
  button.disabled = true;

  try {
    const selectedFile = $("#itemPhoto").files[0] || $("#itemCameraPhoto").files[0];

    const newPhotoBlob = selectedFile
      ? await readPhoto(selectedFile)
      : null;
    const newPhoto = newPhotoBlob
      ? await uploadPhotoBlob(newPhotoBlob, itemId)
      : null;

    const category = $("#productCategory").value;

    const isCard = [
      "pokemon", "sports", "trading"
    ].includes(category);

    const graded = isCard && $("#cardType").value === "graded";

    const item = {
      ...(existing || {}),
      id: itemId,
      name,
      sku: $("#itemSku").value.trim(),
      productCategory: category,
      listedPrice: Math.round(listedPrice * 100) / 100,
      purchaseCost: Math.round(purchaseCost * 100) / 100,
      purchaseCostUnknown: false,
      purchaseDate,
      itemCondition: $("#itemCondition").value,

      photo: newPhoto !== null
        ? newPhoto
        : (existing?.photo || ""),

      notes: $("#itemNotes").value.trim(),
      cardType: isCard ? $("#cardType").value : "",
      gradingCompany: graded ? $("#gradingCompany").value : "",
      cardGrade: graded ? $("#cardGrade").value.trim() : "",
      certNumber: graded ? $("#certNumber").value.trim() : "",

      createdAt: existing?.createdAt || new Date().toISOString()
    };

    const index = data.items.findIndex(
      (entry) => entry.id === item.id
    );

    const saleToAllocate = existing?.purchaseCostUnknown
      ? getSaleForItem(item.id)
      : null;
    const oldFunds = { ...data.funds };
    const oldSale = saleToAllocate ? { ...saleToAllocate } : null;

    if (index >= 0) {
      data.items[index] = item;
    } else {
      data.items.push(item);
    }

    if (saleToAllocate?.status === "paid" && saleToAllocate.fundsAllocated === false) {
      allocatePaidSaleFunds(saleToAllocate, item);
    }

    if (!saveData()) {
      if (existing && index >= 0) {
        data.items[index] = existing;
      } else {
        data.items = data.items.filter(
          (entry) => entry.id !== item.id
        );
      }
      data.funds = oldFunds;
      if (saleToAllocate && oldSale) Object.assign(saleToAllocate, oldSale);

      return;
    }

    form.reset();
    delete form.dataset.editingId;

    $("#purchaseDate").value = todayString();
    $("#itemFormTitle").textContent = "Add inventory item";
    $("#itemFormSubmit").textContent = "Save item";

    updateCategoryOptions();
    setCardFieldsVisibility();

    renderAll();
    showPage("inventory");
    openItemDetails(item.id);

  } catch (error) {
    message.textContent =
      error.message || "Could not save the item.";

    message.classList.add("error");

  } finally {
    button.disabled = false;
  }
}

function startEditingItem(itemId) {
  const item = data.items.find(
    (entry) => entry.id === itemId
  );

  if (!item) return;

  showPage("add");

  const form = $("#itemForm");
  form.dataset.editingId = item.id;

  updateCategoryOptions();

  $("#productCategory").value = item.productCategory;

  setCardFieldsVisibility(item.itemCondition);

  $("#itemName").value = item.name;
  $("#listedPrice").value = item.listedPrice ?? "";
  $("#purchaseCost").value = item.purchaseCost;
  if (item.purchaseCostUnknown) $("#purchaseCost").value = "";
  $("#purchaseDate").value = item.purchaseDate;
  $("#itemSku").value = item.sku || "";

  $("#itemCondition").value =
    item.itemCondition || "Not specified";

  $("#itemNotes").value = item.notes || "";
  $("#cardType").value = item.cardType || "raw";
  $("#gradingCompany").value = item.gradingCompany || "";
  $("#cardGrade").value = item.cardGrade || "";
  $("#certNumber").value = item.certNumber || "";
  $("#itemPhoto").value = "";
  $("#itemCameraPhoto").value = "";

  setGradingFieldsVisibility();

  $("#itemFormTitle").textContent = "Edit inventory item";
  $("#itemFormSubmit").textContent = "Save changes";

  $("#formMessage").textContent = item.photo
    ? "Existing photo will be kept unless you select a replacement."
    : "";

  closeDetails();
}

/* =========================================
   ITEM DETAILS
========================================= */

function detailBox(label, value) {
  return `
    <div class="detail-box">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>`;
}

function openItemDetails(itemId) {
  const item = data.items.find(
    (entry) => entry.id === itemId
  );

  if (!item) return;

  const sale = getSaleForItem(itemId);

  $("#detailsTitle").textContent = item.name;

  $("#detailsSubtitle").textContent =
    `${categoryName(item)} · ${formatDate(item.purchaseDate)}`;

  let html = '<div class="detail-grid">';

  html += detailBox("Listed price", money(item.listedPrice || 0));
  html += detailBox("Purchase cost", item.purchaseCostUnknown ? "Not recorded yet" : money(item.purchaseCost));
  html += detailBox("Purchase date", formatDate(item.purchaseDate));
  html += detailBox("Category", categoryName(item));
  if (item.sku) html += detailBox("SKU", item.sku);

  html += detailBox(
    "Condition",
    item.itemCondition || "Not specified"
  );

  if (isTradingCard(item)) {
    html += detailBox(
      "Card status",
      item.cardType === "graded"
        ? "Graded"
        : "Raw / ungraded"
    );

    if (item.cardType === "graded") {
      html += detailBox(
        "Grading company",
        item.gradingCompany || "Not specified"
      );

      html += detailBox(
        "Grade",
        item.cardGrade || "Not specified"
      );

      html += detailBox(
        "Certification number",
        item.certNumber || "Not specified"
      );
    }
  }

  html += "</div>";

  if (item.photo) {
    const embeddedPhoto = item.photo.startsWith("data:");
    html += `
      <img class="details-photo"
        ${embeddedPhoto ? `src="${escapeHtml(item.photo)}"` : `data-photo-path="${escapeHtml(item.photo)}"`}
        alt="${escapeHtml(item.name)}">`;
  }

  if (item.notes) {
    html += `
      <p class="details-notes">
        ${escapeHtml(item.notes)}
      </p>`;
  }

  if (sale) {
    html += '<div class="detail-grid sale-detail-grid">';

    html += detailBox("Sale price", money(sale.salePrice));
    html += detailBox("Platform fees", money(sale.platformFees));
    html += detailBox("Shipping", money(sale.shipping));
    html += detailBox("Other sale costs", money(sale.otherCosts));
    html += detailBox("Net proceeds", money(netProceeds(sale)));
    html += detailBox("Profit / loss", saleProfit(sale) === null ? "Add purchase cost to calculate" : money(saleProfit(sale)));
    html += detailBox("Sale date", formatDate(sale.saleDate));
    if (sale.reinvestmentPercent !== undefined) {
      const reinvestPercent = Math.max(0, Math.min(100, Number(sale.reinvestmentPercent) || 0));
      html += detailBox("Profit split", `${reinvestPercent}% reinvest · ${100 - reinvestPercent}% personal`);
    }
    if (sale.saleDateEstimated) {
      html += `<p class="field-hint sale-date-estimate">The eBay report gave a date range, not an exact sale date. This sale is dated to the report end: ${escapeHtml(formatDate(sale.saleReportEndDate || sale.saleDate))}.</p>`;
    }

    html += detailBox(
      "Payout",
      sale.status === "paid" ? "Paid" : "Pending"
    );

    html += "</div>";

    html += `
      <div class="detail-actions">
        <button class="secondary-button" type="button"
          data-edit-item="${escapeHtml(item.id)}">
          ${item.purchaseCostUnknown ? "Add purchase cost" : "Edit item details"}
        </button>
      </div>`;

    if (sale.status === "pending") {
      html += `
        <div class="detail-actions">

          <button class="primary-button" type="button"
            data-mark-paid="${escapeHtml(sale.id)}">
            Mark as paid
          </button>

          <button class="danger-button" type="button"
            data-delete-sale="${escapeHtml(sale.id)}">
            Cancel sale
          </button>

        </div>`;
    }

  } else {
    html += `
      <div class="detail-actions">

        <button class="primary-button" type="button"
          data-start-sale="${escapeHtml(item.id)}">
          Record sale
        </button>

        <button class="secondary-button" type="button"
          data-edit-item="${escapeHtml(item.id)}">
          Edit item
        </button>

        <button class="secondary-button" type="button"
          data-duplicate-item="${escapeHtml(item.id)}">
          Duplicate item
        </button>

        <button class="danger-button" type="button"
          data-delete-item="${escapeHtml(item.id)}">
          Delete item
        </button>

      </div>`;
  }

  $("#detailsContent").innerHTML = html;
  $("#itemDetails").classList.remove("hidden");
  hydratePhotos($("#detailsContent"));
}

function closeDetails() {
  $("#itemDetails").classList.add("hidden");
}

/* =========================================
   SALES
========================================= */

function showSaleForm(itemId) {
  const item = data.items.find(
    (entry) => entry.id === itemId
  );

  if (!item || getSaleForItem(itemId)) return;

  $("#saleForm")?.remove();

  $("#detailsContent").insertAdjacentHTML("beforeend", `
    <form id="saleForm" class="sale-form">

      <h3>Record sale</h3>

      <div class="form-grid">

        <label class="field">
          Sale price ($) *
          <input name="salePrice" type="number"
            min="0" step="0.01" required>
        </label>

        <label class="field">
          Sale date *
          <input name="saleDate" type="date"
            value="${todayString()}" required>
        </label>

        <label class="field">
          Platform fees ($)
          <input name="platformFees" type="number"
            min="0" step="0.01" value="0" required>
        </label>

        <label class="field">
          Shipping ($)
          <input name="shipping" type="number"
            min="0" step="0.01" value="0" required>
        </label>

        <label class="field full-width">
          Other sale costs ($)
          <input name="otherCosts" type="number"
            min="0" step="0.01" value="0" required>
        </label>

        <label class="field full-width">
          Sale screenshot (optional)
          <input name="saleScreenshot" type="file" accept="image/*">
          <span class="field-hint">Text is read on this device. Review recognized details before saving.</span>
        </label>

      </div>

      <div class="sale-summary" id="saleEstimate">
        Enter a sale price to estimate proceeds and profit.
      </div>

      <div class="detail-actions">

        <button class="primary-button" type="submit">
          Save pending sale
        </button>

        <button class="secondary-button" type="button"
          data-cancel-sale-form="true">
          Cancel
        </button>

      </div>

      <p id="saleMessage" class="form-message" role="status"></p>

    </form>
  `);

  const form = $("#saleForm");

  function updateEstimate() {
    const values = new FormData(form);

    const net =
      Number(values.get("salePrice") || 0) -
      Number(values.get("platformFees") || 0) -
      Number(values.get("shipping") || 0) -
      Number(values.get("otherCosts") || 0);

    $("#saleEstimate").innerHTML = `
      Estimated net proceeds: <strong>${money(net)}</strong><br>
      Estimated profit / loss:
      <strong>${money(net - Number(item.purchaseCost))}</strong>`;
  }

  form.addEventListener("input", updateEstimate);

  form.querySelector('[name="saleScreenshot"]').addEventListener("change", readSaleScreenshot);

  form.addEventListener("submit", (event) => {
    saveSale(event, itemId);
  });
}

function parseSaleScreenshotText(text) {
  const parsed = {};
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const moneyPattern = /\$\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/;
  const findAmount = (labels) => {
    const line = lines.find((entry) => labels.test(entry));
    const match = line?.match(moneyPattern);
    return match ? Number(match[1].replaceAll(",", "")) : null;
  };

  const salePrice = findAmount(/sold for|sale price|item price|order total|\bsold\b/i);
  if (salePrice !== null) parsed.salePrice = salePrice;

  const fees = findAmount(/selling fee|platform fee|\bfees?\b|commission/i);
  if (fees !== null) parsed.platformFees = fees;

  const shipping = findAmount(/shipping|postage/i);
  if (shipping !== null) parsed.shipping = shipping;

  const dateMatch = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b|\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (dateMatch) {
    const [, yearA, monthA, dayA, monthB, dayB, yearB] = dateMatch;
    const year = yearA || yearB;
    const month = (monthA || monthB).padStart(2, "0");
    const day = (dayA || dayB).padStart(2, "0");
    parsed.saleDate = `${year}-${month}-${day}`;
  }

  return parsed;
}

async function readSaleScreenshot(event) {
  const file = event.currentTarget.files[0];
  const message = $("#saleMessage");
  if (!file) return;
  if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
    message.textContent = "Choose an image smaller than 12 MB.";
    message.classList.add("error");
    return;
  }
  if (!window.Tesseract) {
    message.textContent = "Screenshot reading could not load. Enter the sale details manually.";
    message.classList.add("error");
    return;
  }

  message.classList.remove("error");
  message.textContent = "Reading screenshot on this device…";
  let worker;
  try {
    worker = await window.Tesseract.createWorker("eng");
    const { data: result } = await worker.recognize(file);
    const parsed = parseSaleScreenshotText(result.text || "");
    const form = $("#saleForm");
    ["salePrice", "platformFees", "shipping", "saleDate"].forEach((name) => {
      if (parsed[name] !== undefined) form.elements.namedItem(name).value = parsed[name];
    });
    form.dispatchEvent(new Event("input", { bubbles: true }));
    message.textContent = Object.keys(parsed).length
      ? "Recognized details were filled in. Review them before saving."
      : "No sale details were recognized. Enter them manually.";
  } catch (error) {
    console.error("Sale screenshot OCR failed:", error);
    message.textContent = "Could not read this screenshot. Enter the sale details manually.";
    message.classList.add("error");
  } finally {
    await worker?.terminate();
  }
}

function saveSale(event, itemId) {
  event.preventDefault();

  const values = new FormData(event.currentTarget);

  const salePrice = Number(values.get("salePrice"));
  const platformFees = Number(values.get("platformFees"));
  const shipping = Number(values.get("shipping"));
  const otherCosts = Number(values.get("otherCosts"));
  const saleDate = String(values.get("saleDate") || "");

  if (!saleDate ||
      [salePrice, platformFees, shipping, otherCosts]
        .some((amount) => !Number.isFinite(amount) || amount < 0)) {
    $("#saleMessage").textContent =
      "Enter valid dates and nonnegative amounts.";

    $("#saleMessage").classList.add("error");
    return;
  }

  if (getSaleForItem(itemId)) {
    $("#saleMessage").textContent =
      "This item already has a sale recorded.";

    $("#saleMessage").classList.add("error");
    return;
  }

  const sale = {
    id: makeId(),
    itemId,
    salePrice,
    platformFees,
    shipping,
    otherCosts,
    saleDate,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  data.sales.push(sale);

  if (!saveData()) {
    data.sales = data.sales.filter(
      (entry) => entry.id !== sale.id
    );

    return;
  }

  renderAll();
  openItemDetails(itemId);
}

function markSalePaid(saleId) {
  const sale = data.sales.find(
    (entry) => entry.id === saleId
  );

  if (!sale || sale.status !== "pending") return;

  const item = data.items.find(
    (entry) => entry.id === sale.itemId
  );

  if (!item) return;

  const oldFunds = { ...data.funds };
  const oldSale = { ...sale };

  sale.status = "paid";
  sale.paidDate = todayString();
  sale.paidAt = new Date().toISOString();
  allocatePaidSaleFunds(sale, item);
  if (item.purchaseCostUnknown) sale.fundsAllocated = false;

  if (!saveData()) {
    data.funds = oldFunds;
    Object.assign(sale, oldSale);
    return;
  }

  renderAll();
  openItemDetails(item.id);
}

function cancelSale(saleId) {
  const sale = data.sales.find(
    (entry) => entry.id === saleId
  );

  if (!sale || sale.status !== "pending") return;

  if (!confirm(
    "Cancel this pending sale and return the item to inventory?"
  )) {
    return;
  }

  data.sales = data.sales.filter(
    (entry) => entry.id !== saleId
  );

  if (!saveData()) {
    data.sales.push(sale);
    return;
  }

  renderAll();
  openItemDetails(sale.itemId);
}

function duplicateItem(itemId) {
  const original = data.items.find(
    (entry) => entry.id === itemId
  );

  if (!original) return;

  const copy = {
    ...original,
    id: makeId(),
    createdAt: new Date().toISOString()
  };

  data.items.push(copy);

  if (!saveData()) {
    data.items = data.items.filter(
      (entry) => entry.id !== copy.id
    );

    return;
  }

  renderAll();
  openItemDetails(copy.id);
}

function deleteItem(itemId) {
  const item = data.items.find(
    (entry) => entry.id === itemId
  );

  if (!item) return;

  if (getSaleForItem(itemId)) {
    alert("Items with recorded sales cannot be deleted.");
    return;
  }

  if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) {
    return;
  }

  data.items = data.items.filter(
    (entry) => entry.id !== itemId
  );

  if (!saveData()) {
    data.items.push(item);
    return;
  }

  closeDetails();
  renderAll();
}

/* =========================================
   EVENT HANDLERS
========================================= */

document.addEventListener("click", (event) => {
  const target = event.target;

  const pageButton = target.closest("[data-page]");

  if (pageButton) {
    return showPage(pageButton.dataset.page);
  }

  const goButton = target.closest("[data-go]");

  if (goButton) {
    return showPage(goButton.dataset.go);
  }

  const openButton = target.closest("[data-open-item]");

  if (openButton) {
    return openItemDetails(openButton.dataset.openItem);
  }

  const editButton = target.closest("[data-edit-item]");

  if (editButton) {
    return startEditingItem(editButton.dataset.editItem);
  }

  const saleButton = target.closest("[data-start-sale]");

  if (saleButton) {
    return showSaleForm(saleButton.dataset.startSale);
  }

  const paidButton = target.closest("[data-mark-paid]");

  if (paidButton) {
    return markSalePaid(paidButton.dataset.markPaid);
  }

  const cancelButton = target.closest("[data-delete-sale]");

  if (cancelButton) {
    return cancelSale(cancelButton.dataset.deleteSale);
  }

  const duplicateButton = target.closest("[data-duplicate-item]");

  if (duplicateButton) {
    return duplicateItem(duplicateButton.dataset.duplicateItem);
  }

  const deleteButton = target.closest("[data-delete-item]");

  if (deleteButton) {
    return deleteItem(deleteButton.dataset.deleteItem);
  }

  if (target.closest("[data-cancel-sale-form]")) {
    $("#saleForm")?.remove();
  }
});

/* =========================================
   SEARCH AND FORM LISTENERS
========================================= */

$("#quickAddButton").addEventListener("click", () => {
  showPage("add");
});

$("#closeDetails").addEventListener("click", closeDetails);

$("#searchItemPhotoButton").addEventListener("click", () => {
  const query = $("#itemName").value.trim() || "product photo";
  const searchUrl = new URL("https://www.bing.com/images/search");
  searchUrl.searchParams.set("q", query);
  window.open(searchUrl.href, "_blank", "noopener,noreferrer");
});

$("#itemForm").addEventListener("submit", saveItemForm);

$("#productCategory").addEventListener("change", () => {
  if ($("#productCategory").value === "__add_custom__") {
    createCustomCategory();
  } else {
    setCardFieldsVisibility();
  }
});

$("#cardType").addEventListener(
  "change",
  setGradingFieldsVisibility
);

$("#inventorySearch").addEventListener(
  "input",
  renderInventory
);

$("#globalSearch").addEventListener("input", (event) => {
  $("#inventorySearch").value = event.target.value;

  showPage("inventory");
  renderInventory();
});

$("#categoryFilter").addEventListener(
  "change",
  renderInventory
);

setupDataTools();
setupEbayImport();

/* =========================================
   INITIALIZE
========================================= */

function setAuthMessage(message, isError = false) {
  const node = $("#authMessage");
  node.textContent = message;
  node.classList.toggle("error", isError);
}

function setAuthenticatedView(isAuthenticated) {
  $("#authGate").classList.toggle("hidden", isAuthenticated);
  $("#appShell").classList.toggle("auth-locked", !isAuthenticated);
  $("#bottomNav").classList.toggle("auth-locked", !isAuthenticated);
}

async function loadAccountData(user) {
  const { data: row, error } = await supabaseClient
    .from(CLOUD_TABLE)
    .select("payload")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  const accountKey = `${STORAGE_KEY}:${user.id}`;
  if (row?.payload) {
    data = normalizeData(row.payload);
    try { localStorage.setItem(accountKey, JSON.stringify(data)); }
    catch (error) { console.warn("Local cache could not be updated:", error); }
  } else {
    const savedAccountCopy = localStorage.getItem(accountKey);
    const legacyCopy = localStorage.getItem(STORAGE_KEY);
    data = savedAccountCopy
      ? loadData(accountKey)
      : (legacyCopy ? loadData(STORAGE_KEY) : createEmptyData());

    const { error: saveError } = await supabaseClient
      .from(CLOUD_TABLE)
      .upsert({ user_id: user.id, payload: data }, { onConflict: "user_id" });
    if (saveError) throw saveError;
    try {
      localStorage.setItem(accountKey, JSON.stringify(data));
      if (legacyCopy) localStorage.removeItem(STORAGE_KEY);
    } catch (cacheError) {
      console.warn("Local cache could not be updated:", cacheError);
    }
  }

  applyCustomCategoryNames();
  updateCategoryOptions();
  $("#purchaseDate").value = todayString();
  setCardFieldsVisibility();
  renderAll();
}

async function listPhotoStorageEntries(path) {
  const storage = supabaseClient.storage.from(PHOTO_BUCKET);
  const entries = [];
  const limit = 1000;
  for (let offset = 0; ; offset += limit) {
    const { data: page, error } = await storage.list(path, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw error;
    const batch = Array.isArray(page) ? page : [];
    entries.push(...batch);
    if (batch.length < limit) break;
  }
  return entries;
}

async function deleteAccountPhotos(userId) {
  const storage = supabaseClient.storage.from(PHOTO_BUCKET);
  const rootEntries = await listPhotoStorageEntries(userId);
  const paths = [];

  for (const entry of rootEntries) {
    if (entry.id == null) {
      const itemEntries = await listPhotoStorageEntries(userId + "/" + entry.name);
      paths.push(...itemEntries
        .filter((photo) => photo.id != null)
        .map((photo) => userId + "/" + entry.name + "/" + photo.name));
    } else {
      paths.push(userId + "/" + entry.name);
    }
  }

  for (let index = 0; index < paths.length; index += 1000) {
    const { error } = await storage.remove(paths.slice(index, index + 1000));
    if (error) throw error;
  }
}

async function resetAccountData() {
  const button = $("#resetAccountDataButton");
  const message = $("#accountResetMessage");
  const userId = supabaseUser?.id;
  if (!userId) {
    message.textContent = "Sign in before resetting account data.";
    message.classList.add("error");
    return;
  }
  if (!window.confirm(
    "Permanently reset this CACHE account? This clears all inventory, sales, balances, custom categories, and stored item photos. This cannot be undone."
  )) return;

  button.disabled = true;
  message.textContent = "Resetting account data…";
  message.classList.remove("error");
  try {
    await remoteSaveQueue;
    const emptyData = createEmptyData();
    const { error } = await supabaseClient
      .from(CLOUD_TABLE)
      .upsert({ user_id: userId, payload: emptyData }, { onConflict: "user_id" });
    if (error) throw error;

    data = emptyData;
    for (const key of Object.keys(CATEGORY_NAMES)) {
      if (key.startsWith("custom_")) delete CATEGORY_NAMES[key];
    }
    try {
      localStorage.setItem(STORAGE_KEY + ":" + userId, JSON.stringify(emptyData));
    } catch (cacheError) {
      console.warn("The cleared account cache could not be updated:", cacheError);
    }
    ebayImportRows = [];
    $("#ebayCsvFile").value = "";
    signedPhotoUrls.clear();
    updateCategoryOptions();
    renderEbayPreview();
    renderAll();

    message.textContent = "Account data cleared. Removing stored item photos…";
    try {
      await deleteAccountPhotos(userId);
      message.textContent = "Account data and stored item photos have been reset.";
    } catch (photoError) {
      console.error("Could not remove every account photo:", photoError);
      message.textContent = "Account data was cleared, but some stored photos could not be removed. Try again or contact support.";
      message.classList.add("error");
    }
  } catch (error) {
    console.error("Could not reset account data:", error);
    message.textContent = error.message || "Could not reset account data. Please try again.";
    message.classList.add("error");
  } finally {
    button.disabled = false;
  }
}

async function handleAuthSession(session) {
  const user = session?.user || null;
  if (!user) {
    supabaseUser = null;
    loadedUserId = null;
    data = createEmptyData();
    $("#accountEmail").textContent = "Your CACHE account";
    setAuthenticatedView(false);
    return;
  }

  supabaseUser = user;
  $("#accountEmail").textContent = user.email || "Signed in to CACHE";
  setAuthMessage("Loading your inventory…");
  setAuthenticatedView(false);
  if (loadedUserId === user.id) {
    setAuthenticatedView(true);
    return;
  }

  try {
    await loadAccountData(user);
    loadedUserId = user.id;
    setAuthMessage("");
    setAuthenticatedView(true);
    migrateEmbeddedPhotos().catch((error) => {
      console.error("Could not migrate embedded photos:", error);
      const toast = $("#toast");
      toast.textContent = "Some older photos could not be moved to private storage yet.";
      toast.classList.add("show");
      window.setTimeout(() => toast.classList.remove("show"), 5000);
    });
  } catch (error) {
    console.error("Could not load account data:", error);
    setAuthMessage("Could not load your cloud data. Check the database setup and try again.", true);
  }
}

async function signIn(event) {
  event.preventDefault();
  setAuthMessage("Signing in…");
  const { email, password } = Object.fromEntries(new FormData(event.currentTarget));
  const { data: result, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return setAuthMessage(error.message, true);
  await handleAuthSession(result.session);
}

async function signUp() {
  setAuthMessage("Creating your account…");
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  if (!email || password.length < 8) {
    return setAuthMessage("Enter an email and a password with at least 8 characters.", true);
  }
  const { data: result, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) return setAuthMessage(error.message, true);
  if (result.session) await handleAuthSession(result.session);
  else setAuthMessage("Account created. Check your email to confirm, then sign in.");
}

$("#authForm").addEventListener("submit", signIn);
$("#signUpButton").addEventListener("click", signUp);
async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) setAuthMessage(error.message, true);
  else await handleAuthSession(null);
}

$("#signOutButton").addEventListener("click", signOut);
$("#accountSignOutButton").addEventListener("click", signOut);
$("#resetAccountDataButton").addEventListener("click", resetAccountData);

supabaseClient.auth.onAuthStateChange((_event, session) => {
  window.setTimeout(() => handleAuthSession(session), 0);
});

supabaseClient.auth.getSession().then(({ data: sessionData, error }) => {
  if (error) return setAuthMessage("Could not check your sign-in session. Refresh and try again.", true);
  handleAuthSession(sessionData.session);
});
