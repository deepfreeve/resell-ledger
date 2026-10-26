"use strict";
/*
  ResellLedger
  Starter version: saves data in this browser using localStorage.
  Cloud synchronization and user accounts are not connected yet.
*/
const STORAGE_KEY = "resellledger_data_v1";
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
const $ = (selector) => document.querySelector(selector);
function createEmptyData() {
  return {
    items: [],
    sales: [],
    funds: {
      capital: 0,
      reinvestment: 0,
      personal: 0
    }
  };
}
function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createEmptyData();
    const data = JSON.parse(stored);
    return {
      items: Array.isArray(data.items) ? data.items : [],
      sales: Array.isArray(data.sales) ? data.sales : [],
      funds: {
        capital: Number(data.funds?.capital) || 0,
        reinvestment: Number(data.funds?.reinvestment) || 0,
        personal: Number(data.funds?.personal) || 0
      }
    };
  } catch (error) {
    console.error("Could not load ResellLedger data:", error);
    return createEmptyData();
  }
}
let data = loadData();
let selectedItemId = null;
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Could not save ResellLedger data:", error);
    alert(
      "Your browser could not save this change. Storage may be full, " +
      "especially if you added large photos. Try removing large photos."
    );
    return false;
  }
}
function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return Date.now().toString(36) + "-" +
    Math.random().toString(36).slice(2, 12);
}
function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value) || 0);
}
function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return replacements[character];
  });
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
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function isTradingCard(item) {
  return ["pokemon", "sports", "trading"].includes(item.productCategory);
}
function getCategoryName(item) {
  return CATEGORY_NAMES[item.productCategory] || "Other";
}
function getSaleForItem(itemId) {
  return data.sales.find((sale) => sale.itemId === itemId);
}
function getNetProceeds(sale) {
  return numberValue(sale.salePrice) -
    numberValue(sale.platformFees) -
    numberValue(sale.shipping) -
    numberValue(sale.otherCosts);
}
function getSaleProfit(sale) {
  const item = data.items.find((entry) => entry.id === sale.itemId);
  if (!item) return 0;
  return getNetProceeds(sale) - numberValue(item.purchaseCost);
}
function getPendingTotal() {
  return data.sales
    .filter((sale) => sale.status === "pending")
    .reduce((total, sale) => total + getNetProceeds(sale), 0);
}
function getLifetimeProfit() {
  return data.sales
    .filter((sale) => sale.status === "paid")
    .reduce((total, sale) => total + getSaleProfit(sale), 0);
}
function updateDashboard() {
  $("#capitalValue").textContent = money(data.funds.capital);
  $("#reinvestmentValue").textContent = money(data.funds.reinvestment);
  $("#personalValue").textContent = money(data.funds.personal);
  $("#pendingValue").textContent = money(getPendingTotal());
  $("#lifetimeProfitValue").textContent = money(getLifetimeProfit());
}
function emptyState(title, description, buttonText, page) {
  return `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      ${
        buttonText && page
          ? `<button class="primary-button" type="button"
              data-go="${escapeHtml(page)}"
              style="margin-top:16px">${escapeHtml(buttonText)}</button>`
          : ""
      }
    </div>
  `;
}
function itemIcon(item) {
  if (isTradingCard(item)) return "▤";
  const icons = {
    videogames: "▣",
    electronics: "⌘",
    clothing: "◇",
    collectibles: "✧",
    other: "□"
  };
  return icons[item.productCategory] || "□";
}
function itemThumbnail(item) {
  if (item.photo) {
    return `
      <div class="item-thumbnail">
        <img src="${escapeHtml(item.photo)}" alt=""
          loading="lazy">
      </div>
    `;
  }
  return `
    <div class="item-thumbnail" aria-hidden="true">
      ${itemIcon(item)}
    </div>
  `;
}
function itemRow(item, options = {}) {
  const sale = getSaleForItem(item.id);
  let status = "Available";
  if (sale?.status === "pending") status = "Pending payout";
  if (sale?.status === "paid") status = "Sold";
  const price = sale
    ? money(getNetProceeds(sale))
    : money(item.purchaseCost);
  const priceLabel = sale ? "Net proceeds" : "Purchase cost";
  return `
    <article class="item-row">
      ${itemThumbnail(item)}
      <div class="item-main">
        <div class="item-title">${escapeHtml(item.name)}</div>
        <div class="item-meta">
          <span>${escapeHtml(getCategoryName(item))}</span>
          <span>${escapeHtml(item.itemCondition || "Not specified")}</span>
          <span>${escapeHtml(formatDate(item.purchaseDate))}</span>
        </div>
        <div style="margin-top:7px">
          <span class="status-pill ${
            sale?.status === "pending"
              ? "pending"
              : sale?.status === "paid"
                ? "paid"
                : ""
          }">${escapeHtml(status)}</span>
        </div>
      </div>
      <div class="item-price">
        <strong>${price}</strong>
        <span>${priceLabel}</span>
        <button class="text-button" type="button"
          data-open-item="${escapeHtml(item.id)}">Details</button>
      </div>
    </article>
  `;
}
function renderRecentInventory() {
  const container = $("#recentInventory");
  const recent = [...data.items]
    .filter((item) => !getSaleForItem(item.id))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 5);
  if (!recent.length) {
    container.innerHTML = emptyState(
      "Your inventory starts here",
      "Add your first item to begin tracking costs and profits.",
      "Add your first item",
      "add"
    );
    return;
  }
  container.innerHTML = recent.map((item) => itemRow(item)).join("");
}
function renderInventory() {
  const container = $("#inventoryList");
  const query = ($("#inventorySearch").value || "").trim().toLowerCase();
  const category = $("#categoryFilter").value;
  const available = data.items
    .filter((item) => !getSaleForItem(item.id))
    .filter((item) => {
      const matchesQuery =
        item.name.toLowerCase().includes(query) ||
        (item.notes || "").toLowerCase().includes(query);
      const matchesCategory =
        category === "all" || item.productCategory === category;
      return matchesQuery && matchesCategory;
    })
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  container.innerHTML = available.length
    ? available.map((item) => itemRow(item)).join("")
    : emptyState(
        "No inventory found",
        query || category !== "all"
          ? "Try changing your search or category filter."
          : "Add an item to see it here.",
        "Add item",
        "add"
      );
}
function renderPending() {
  const container = $("#pendingList");
  const pendingSales = data.sales
    .filter((sale) => sale.status === "pending")
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  if (!pendingSales.length) {
    container.innerHTML = emptyState(
      "No pending payouts",
      "When you record a sale, it will appear here until you mark it paid.",
      "View inventory",
      "inventory"
    );
    return;
  }
  container.innerHTML = pendingSales.map((sale) => {
    const item = data.items.find((entry) => entry.id === sale.itemId);
    if (!item) return "";
    return `
      <article class="item-row">
        ${itemThumbnail(item)}
        <div class="item-main">
          <div class="item-title">${escapeHtml(item.name)}</div>
          <div class="item-meta">
            <span>Sale date: ${escapeHtml(formatDate(sale.saleDate))}</span>
            <span class="status-pill pending">Awaiting payout</span>
          </div>
        </div>
        <div class="item-price">
          <strong>${money(getNetProceeds(sale))}</strong>
          <span>Expected net payout</span>
          <button class="text-button" type="button"
            data-open-item="${escapeHtml(item.id)}">Details</button>
        </div>
      </article>
    `;
  }).join("");
}
function renderSold() {
  const container = $("#soldList");
  const paidSales = data.sales
    .filter((sale) => sale.status === "paid")
    .sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || ""));
  if (!paidSales.length) {
    container.innerHTML = emptyState(
      "No completed sales yet",
      "Mark a pending payout as paid to see completed sales here.",
      "View pending",
      "pending"
    );
    return;
  }
  container.innerHTML = paidSales.map((sale) => {
    const item = data.items.find((entry) => entry.id === sale.itemId);
    if (!item) return "";
    const profit = getSaleProfit(sale);
    return `
      <article class="item-row">
        ${itemThumbnail(item)}
        <div class="item-main">
          <div class="item-title">${escapeHtml(item.name)}</div>
          <div class="item-meta">
            <span>Paid: ${escapeHtml(formatDate(sale.paidDate || sale.saleDate))}</span>
            <span class="status-pill paid">Paid</span>
          </div>
        </div>
        <div class="item-price">
          <strong>${money(profit)}</strong>
          <span>Profit / loss</span>
          <button class="text-button" type="button"
            data-open-item="${escapeHtml(item.id)}">Details</button>
        </div>
      </article>
    `;
  }).join("");
}
function renderAll() {
  updateDashboard();
  renderRecentInventory();
  renderInventory();
  renderPending();
  renderSold();
}
function showPage(pageName) {
  const validPages = ["home", "inventory", "add", "pending", "sold"];
  if (!validPages.includes(pageName)) return;
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === `page-${pageName}`);
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });
  if (pageName !== "add") {
    $("#formMessage").textContent = "";
    $("#formMessage").classList.remove("error");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error("Please choose an image smaller than 2 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}
function setCardFieldsVisibility() {
  const category = $("#productCategory").value;
  const showCardFields = ["pokemon", "sports", "trading"].includes(category);
  $("#cardFields").style.display = showCardFields ? "block" : "none";
  if (!showCardFields) {
    $("#gradingFields").style.display = "none";
  } else {
    setGradingFieldsVisibility();
  }
}
function setGradingFieldsVisibility() {
  const isGraded = $("#cardType").value === "graded";
  $("#gradingFields").style.display = isGraded ? "grid" : "none";
}
async function addItem(event) {
  event.preventDefault();
  const message = $("#formMessage");
  message.textContent = "";
  message.classList.remove("error");
  const name = $("#itemName").value.trim();
  const purchaseCost = Number($("#purchaseCost").value);
  const purchaseDate = $("#purchaseDate").value;
  if (!name || !purchaseDate ||
      !Number.isFinite(purchaseCost) || purchaseCost < 0) {
    message.textContent = "Enter an item name, valid cost, and purchase date.";
    message.classList.add("error");
    return;
  }
  const submitButton = $("#itemForm").querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const photo = await readPhoto($("#itemPhoto").files[0]);
    const category = $("#productCategory").value;
    const cardType = $("#cardType").value;
    const isCard = ["pokemon", "sports", "trading"].includes(category);
    const isGraded = isCard && cardType === "graded";
    const item = {
      id: makeId(),
      name,
      productCategory: category,
      purchaseCost: Math.round(purchaseCost * 100) / 100,
      purchaseDate,
      itemCondition: $("#itemCondition").value,
      photo,
      notes: $("#itemNotes").value.trim(),
      cardType: isCard ? cardType : "",
      gradingCompany: isGraded ? $("#gradingCompany").value : "",
      cardGrade: isGraded ? $("#cardGrade").value.trim() : "",
      certNumber: isGraded ? $("#certNumber").value.trim() : "",
      createdAt: new Date().toISOString()
    };
    data.items.push(item);
    if (!saveData()) {
      data.items = data.items.filter((entry) => entry.id !== item.id);
      return;
    }
    $("#itemForm").reset();
    $("#purchaseDate").value = todayString();
    setCardFieldsVisibility();
    message.textContent = "Item saved successfully.";
    renderAll();
    showPage("inventory");
    openItemDetails(item.id);
  } catch (error) {
    message.textContent = error.message || "Could not save this item.";
    message.classList.add("error");
  } finally {
    submitButton.disabled = false;
  }
}
function detailBox(label, value) {
  return `
    <div class="detail-box">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}
function openItemDetails(itemId) {
  const item = data.items.find((entry) => entry.id === itemId);
  if (!item) return;
  selectedItemId = itemId;
  const sale = getSaleForItem(itemId);
  $("#itemDetails").classList.remove("hidden");
  $("#detailsTitle").textContent = item.name;
  $("#detailsSubtitle").textContent =
    `${getCategoryName(item)} · Added ${formatDate(item.purchaseDate)}`;
  let details = `
    <div class="detail-grid">
      ${detailBox("Purchase cost", money(item.purchaseCost))}
      ${detailBox("Purchase date", formatDate(item.purchaseDate))}
      ${detailBox("Category", getCategoryName(item))}
      ${detailBox("Condition", item.itemCondition || "Not specified")}
  `;
  if (isTradingCard(item)) {
    details += detailBox(
      "Card status",
      item.cardType === "graded" ? "Graded" : "Raw / ungraded"
    );
    if (item.cardType === "graded") {
      details += detailBox("Grading company", item.gradingCompany || "Not specified");
      details += detailBox("Grade", item.cardGrade || "Not specified");
      details += detailBox("Certification number", item.certNumber || "Not specified");
    }
  }
  details += `</div>`;
  if (item.photo) {
    details += `
      <div style="margin-bottom:18px">
        <img src="${escapeHtml(item.photo)}"
          alt="${escapeHtml(item.name)}"
          style="max-width:100%;max-height:320px;object-fit:contain;border-radius:12px">
      </div>
    `;
  }
  if (item.notes) {
    details += `
      <p class="muted" style="white-space:pre-wrap">${escapeHtml(item.notes)}</p>
    `;
  }
  if (sale) {
    const net = getNetProceeds(sale);
    const profit = getSaleProfit(sale);
    details += `
      <div class="detail-grid">
        ${detailBox("Sale price", money(sale.salePrice))}
        ${detailBox("Platform fees", money(sale.platformFees))}
        ${detailBox("Shipping", money(sale.shipping))}
        ${detailBox("Other sale costs", money(sale.otherCosts))}
        ${detailBox("Net proceeds", money(net))}
        ${detailBox("Profit / loss", money(profit))}
        ${detailBox("Sale date", formatDate(sale.saleDate))}
        ${detailBox("Payout status", sale.status === "paid" ? "Paid" : "Pending")}
      </div>
    `;
    if (sale.status === "pending") {
      details += `
        <div class="detail-actions">
          <button class="primary-button" type="button" data-mark-paid="${escapeHtml(sale.id)}">
            Mark as paid
          </button>
          <button class="danger-button" type="button" data-delete-sale="${escapeHtml(sale.id)}">
            Cancel sale
          </button>
        </div>
      `;
    }
  } else {
    details += `
      <div class="detail-actions">
        <button class="primary-button" type="button" data-start-sale="${escapeHtml(item.id)}">
          Record sale
        </button>
        <button class="secondary-button" type="button" data-duplicate-item="${escapeHtml(item.id)}">
          Duplicate item
        </button>
        <button class="danger-button" type="button" data-delete-item="${escapeHtml(item.id)}">
          Delete item
        </button>
      </div>
    `;
  }
  $("#detailsContent").innerHTML = details;
  $("#itemDetails").scrollIntoView({ behavior: "smooth", block: "start" });
}
function showSaleForm(itemId) {
  const item = data.items.find((entry) => entry.id === itemId);
  if (!item || getSaleForItem(itemId)) return;
  const details = $("#detailsContent");
  details.insertAdjacentHTML("beforeend", `
    <form id="saleForm" class="sale-form">
      <h3>Record sale</h3>
      <div class="form-grid">
        <label class="field">
          Sale price ($) *
          <input name="salePrice" type="number" min="0" step="0.01"
            placeholder="0.00" required>
        </label>
        <label class="field">
          Sale date *
          <input name="saleDate" type="date" value="${todayString()}" required>
        </label>
        <label class="field">
          Platform fees ($)
          <input name="platformFees" type="number" min="0" step="0.01"
            value="0" required>
        </label>
        <label class="field">
          Shipping ($)
          <input name="shipping" type="number" min="0" step="0.01"
            value="0" required>
        </label>
        <label class="field full-width">
          Other sale costs ($)
          <input name="otherCosts" type="number" min="0" step="0.01"
            value="0" required>
        </label>
        <label class="field full-width">
          Sale screenshot (optional)
          <input name="saleScreenshot" type="file" accept="image/*">
          <span class="field-help">
            The starter version stores the screenshot only as a local reference.
            It does not automatically read sale amounts yet.
          </span>
        </label>
      </div>
      <div class="sale-summary" id="saleEstimate">
        Enter a sale price to calculate estimated net proceeds and profit.
      </div>
      <div class="detail-actions">
        <button class="primary-button" type="submit">Save pending sale</button>
        <button class="secondary-button" type="button" data-cancel-sale-form="true">
          Cancel
        </button>
      </div>
      <p id="saleMessage" class="form-message" role="status"></p>
    </form>
  `);
  const form = $("#saleForm");
  const estimate = $("#saleEstimate");
  function updateEstimate() {
    const values = new FormData(form);
    const price = numberValue(values.get("salePrice"));
    const fees = numberValue(values.get("platformFees"));
    const shipping = numberValue(values.get("shipping"));
    const otherCosts = numberValue(values.get("otherCosts"));
    const net = price - fees - shipping - otherCosts;
    const profit = net - numberValue(item.purchaseCost);
    estimate.innerHTML = `
      Estimated net proceeds: <strong>${money(net)}</strong><br>
      Estimated profit / loss: <strong>${money(profit)}</strong>
    `;
  }
  form.addEventListener("input", updateEstimate);
  form.addEventListener("submit", (event) => saveSale(event, itemId));
}
function saveSale(event, itemId) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const salePrice = Number(values.get("salePrice"));
  const platformFees = Number(values.get("platformFees"));
  const shipping = Number(values.get("shipping"));
  const otherCosts = Number(values.get("otherCosts"));
  const saleDate = String(values.get("saleDate") || "");
  const amounts = [salePrice, platformFees, shipping, otherCosts];
  if (
    !saleDate ||
    amounts.some((amount) => !Number.isFinite(amount) || amount < 0)
  ) {
    $("#saleMessage").textContent = "Enter valid dates and nonnegative amounts.";
    $("#saleMessage").classList.add("error");
    return;
  }
  if (getSaleForItem(itemId)) {
    $("#saleMessage").textContent = "This item already has a sale recorded.";
    $("#saleMessage").classList.add("error");
    return;
  }
  const sale = {
    id: makeId(),
    itemId,
    salePrice: Math.round(salePrice * 100) / 100,
    platformFees: Math.round(platformFees * 100) / 100,
    shipping: Math.round(shipping * 100) / 100,
    otherCosts: Math.round(otherCosts * 100) / 100,
    saleDate,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  data.sales.push(sale);
  if (!saveData()) {
    data.sales = data.sales.filter((entry) => entry.id !== sale.id);
    return;
  }
  renderAll();
  openItemDetails(itemId);
}
function markSalePaid(saleId) {
  const sale = data.sales.find((entry) => entry.id === saleId);
  if (!sale || sale.status !== "pending") return;
  const item = data.items.find((entry) => entry.id === sale.itemId);
  if (!item) {
    alert("The inventory item for this sale could not be found.");
    return;
  }
  const net = getNetProceeds(sale);
  const cost = numberValue(item.purchaseCost);
  // Recover available capital up to the original item cost.
  const recoveredCapital = Math.max(0, Math.min(net, cost));
  // Split only positive profit 50/50 between reinvestment and personal funds.
  const profit = net - cost;
  const positiveProfit = Math.max(0, profit);
  const reinvestmentShare = Math.round(positiveProfit * 50) / 100;
  const personalShare = positiveProfit - reinvestmentShare;
  const previousFunds = { ...data.funds };
  const previousStatus = sale.status;
  const previousPaidDate = sale.paidDate;
  const previousCapitalRecovered = sale.capitalRecovered;
  const previousReinvestmentAdded = sale.reinvestmentAdded;
  const previousPersonalAdded = sale.personalAdded;
  data.funds.capital += recoveredCapital;
  data.funds.reinvestment += reinvestmentShare;
  data.funds.personal += personalShare;
  sale.status = "paid";
  sale.paidDate = todayString();
  sale.capitalRecovered = recoveredCapital;
  sale.reinvestmentAdded = reinvestmentShare;
  sale.personalAdded = personalShare;
  if (!saveData()) {
    data.funds = previousFunds;
    sale.status = previousStatus;
    sale.paidDate = previousPaidDate;
    sale.capitalRecovered = previousCapitalRecovered;
    sale.reinvestmentAdded = previousReinvestmentAdded;
    sale.personalAdded = previousPersonalAdded;
    return;
  }
  renderAll();
  openItemDetails(sale.itemId);
}
function cancelSale(saleId) {
  const sale = data.sales.find((entry) => entry.id === saleId);
  if (!sale || sale.status !== "pending") return;
  if (!confirm("Cancel this pending sale and return the item to inventory?")) {
    return;
  }
  data.sales = data.sales.filter((entry) => entry.id !== saleId);
  if (!saveData()) {
    data.sales.push(sale);
    return;
  }
  selectedItemId = sale.itemId;
  renderAll();
  openItemDetails(sale.itemId);
}
function duplicateItem(itemId) {
  const original = data.items.find((entry) => entry.id === itemId);
  if (!original) return;
  const copy = {
    ...original,
    id: makeId(),
    createdAt: new Date().toISOString(),
    photo: original.photo || ""
  };
  data.items.push(copy);
  if (!saveData()) {
    data.items = data.items.filter((entry) => entry.id !== copy.id);
    return;
  }
  renderAll();
  openItemDetails(copy.id);
}
function deleteItem(itemId) {
  const item = data.items.find((entry) => entry.id === itemId);
  if (!item) return;
  if (getSaleForItem(itemId)) {
    alert("Cancel the pending sale first. Items with recorded sales cannot be deleted.");
    return;
  }
  if (!confirm(`Delete "${item.name}" from your inventory? This cannot be undone.`)) {
    return;
  }
  data.items = data.items.filter((entry) => entry.id !== itemId);
  if (!saveData()) {
    data.items.push(item);
    return;
  }
  selectedItemId = null;
  $("#itemDetails").classList.add("hidden");
  renderAll();
}
function closeDetails() {
  selectedItemId = null;
  $("#itemDetails").classList.add("hidden");
}
document.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    showPage(pageButton.dataset.page);
    return;
  }
  const goButton = event.target.closest("[data-go]");
  if (goButton) {
    showPage(goButton.dataset.go);
    return;
  }
  const openButton = event.target.closest("[data-open-item]");
  if (openButton) {
    openItemDetails(openButton.dataset.openItem);
    return;
  }
  const startSaleButton = event.target.closest("[data-start-sale]");
  if (startSaleButton) {
    showSaleForm(startSaleButton.dataset.startSale);
    return;
  }
  const markPaidButton = event.target.closest("[data-mark-paid]");
  if (markPaidButton) {
    markSalePaid(markPaidButton.dataset.markPaid);
    return;
  }
  const cancelSaleButton = event.target.closest("[data-delete-sale]");
  if (cancelSaleButton) {
    cancelSale(cancelSaleButton.dataset.deleteSale);
    return;
  }
  const duplicateButton = event.target.closest("[data-duplicate-item]");
  if (duplicateButton) {
    duplicateItem(duplicateButton.dataset.duplicateItem);
    return;
  }
  const deleteButton = event.target.closest("[data-delete-item]");
  if (deleteButton) {
    deleteItem(deleteButton.dataset.deleteItem);
    return;
  }
  const cancelSaleFormButton = event.target.closest("[data-cancel-sale-form]");
  if (cancelSaleFormButton) {
    $("#saleForm")?.remove();
    return;
  }
});
$("#quickAddButton").addEventListener("click", () => showPage("add"));
$("#closeDetails").addEventListener("click", closeDetails);
$("#itemForm").addEventListener("submit", addItem);
$("#productCategory").addEventListener("change", setCardFieldsVisibility);
$("#cardType").addEventListener("change", setGradingFieldsVisibility);
$("#inventorySearch").addEventListener("input", renderInventory);
$("#categoryFilter").addEventListener("change", renderInventory);
$("#purchaseDate").value = todayString();
setCardFieldsVisibility();
renderAll();
