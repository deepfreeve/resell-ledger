"use strict";

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

const STANDARD_CONDITIONS = [
  "Not specified", "New", "Like new", "Excellent",
  "Good", "Fair", "Poor", "Damaged"
];

const POKEMON_CONDITIONS = [
  "Not specified", "Near Mint", "Lightly Played",
  "Moderately Played", "Heavily Played", "Damaged"
];

const $ = (selector) => document.querySelector(selector);

function createEmptyData() {
  return {
    items: [],
    sales: [],
    customCategories: [],
    funds: { capital: 0, reinvestment: 0, personal: 0 }
  };
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createEmptyData();

    const saved = JSON.parse(stored);

    return {
      items: Array.isArray(saved.items) ? saved.items : [],
      sales: Array.isArray(saved.sales) ? saved.sales : [],
      customCategories: Array.isArray(saved.customCategories)
        ? saved.customCategories : [],
      funds: {
        capital: Number(saved.funds?.capital) || 0,
        reinvestment: Number(saved.funds?.reinvestment) || 0,
        personal: Number(saved.funds?.personal) || 0
      }
    };
  } catch (error) {
    console.error("Could not load data:", error);
    return createEmptyData();
  }
}

let data = loadData();

function applyCustomCategoryNames() {
  data.customCategories.forEach((category) => {
    CATEGORY_NAMES[category.id] = category.name;
  });
}

applyCustomCategoryNames();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    alert(
      "Could not save. Your browser storage may be full. " +
      "Try using smaller photos."
    );
    console.error(error);
    return false;
  }
}

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

function isPokemon(item) {
  return item.productCategory === "pokemon";
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
  return item ? netProceeds(sale) - Number(item.purchaseCost || 0) : 0;
}

function pendingTotal() {
  return data.sales
    .filter((sale) => sale.status === "pending")
    .reduce((total, sale) => total + netProceeds(sale), 0);
}

function lifetimeProfit() {
  return data.sales
    .filter((sale) => sale.status === "paid")
    .reduce((total, sale) => total + saleProfit(sale), 0);
}

/* Custom categories */

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

  productSelect.add(new Option("+ Create custom category…", "__add_custom__"));

  if ([...productSelect.options].some((option) => option.value === previousProduct)) {
    productSelect.value = previousProduct;
  }

  if ([...filterSelect.options].some((option) => option.value === previousFilter)) {
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

  const duplicate = Object.values(CATEGORY_NAMES).some(
    (existing) => existing.toLowerCase() === cleanedName.toLowerCase()
  );

  if (duplicate) {
    alert("That category already exists.");
    return;
  }

  const id = "custom_" + makeId().replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);

  data.customCategories.push({ id, name: cleanedName });
  CATEGORY_NAMES[id] = cleanedName;

  if (!saveData()) {
    data.customCategories = data.customCategories.filter(
      (category) => category.id !== id
    );
    delete CATEGORY_NAMES[id];
    return;
  }

  updateCategoryOptions();
  $("#productCategory").value = id;
  setCardFieldsVisibility();
  renderAll();
}

/* Conditions and card fields */

function setConditionOptions() {
  const select = $("#itemCondition");
  const previous = select.value;
  const conditions = $("#productCategory").value === "pokemon"
    ? POKEMON_CONDITIONS
    : STANDARD_CONDITIONS;

  select.innerHTML = "";

  conditions.forEach((condition) => {
    select.add(new Option(condition, condition));
  });

  if (conditions.includes(previous)) {
    select.value = previous;
  } else {
    select.value = "Not specified";
  }
}

function setCardFieldsVisibility() {
  const category = $("#productCategory").value;
  const showCardFields = ["pokemon", "sports", "trading"].includes(category);

  $("#cardFields").style.display = showCardFields ? "block" : "none";

  setConditionOptions();
  setGradingFieldsVisibility();
}

function setGradingFieldsVisibility() {
  const isCard = ["pokemon", "sports", "trading"].includes(
    $("#productCategory").value
  );

  $("#gradingFields").style.display =
    isCard && $("#cardType").value === "graded" ? "grid" : "none";
}

/* Dashboard */

function updateDashboard() {
  $("#capitalValue").textContent = money(data.funds.capital);
  $("#reinvestmentValue").textContent = money(data.funds.reinvestment);
  $("#personalValue").textContent = money(data.funds.personal);
  $("#pendingValue").textContent = money(pendingTotal());
  $("#lifetimeProfitValue").textContent = money(lifetimeProfit());
}

function emptyState(title, description, buttonText, page) {
  return `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      ${buttonText && page ? `
        <button class="primary-button" type="button"
          data-go="${escapeHtml(page)}"
          style="margin-top:16px">${escapeHtml(buttonText)}</button>
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
    return `<div class="item-thumbnail">
      <img src="${escapeHtml(item.photo)}" alt="" loading="lazy">
    </div>`;
  }

  return `<div class="item-thumbnail" aria-hidden="true">${itemIcon(item)}</div>`;
}

function itemRow(item) {
  const sale = getSaleForItem(item.id);
  const status = sale
    ? sale.status === "paid" ? "Sold" : "Pending payout"
    : "Available";

  const price = sale ? money(netProceeds(sale)) : money(item.purchaseCost);
  const priceLabel = sale ? "Net proceeds" : "Purchase cost";

  return `
    <article class="item-row">
      ${thumbnail(item)}
      <div class="item-main">
        <div class="item-title">${escapeHtml(item.name)}</div>
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
        <strong>${price}</strong>
        <span>${priceLabel}</span>
        <button class="text-button" type="button"
          data-open-item="${escapeHtml(item.id)}">Details</button>
      </div>
    </article>`;
}

function renderRecentInventory() {
  const items = data.items
    .filter((item) => !getSaleForItem(item.id))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 5);

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
  const query = ($("#inventorySearch").value || "").trim().toLowerCase();
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
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

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
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  $("#pendingList").innerHTML = sales.length
    ? sales.map((sale) => {
        const item = data.items.find((entry) => entry.id === sale.itemId);
        if (!item) return "";

        return `
          <article class="item-row">
            ${thumbnail(item)}
            <div class="item-main">
              <div class="item-title">${escapeHtml(item.name)}</div>
              <div class="item-meta">
                <span>Sale date: ${escapeHtml(formatDate(sale.saleDate))}</span>
                <span class="status-pill pending">Awaiting payout</span>
              </div>
            </div>
            <div class="item-price">
              <strong>${money(netProceeds(sale))}</strong>
              <span>Expected payout</span>
              <button class="text-button" type="button"
                data-open-item="${escapeHtml(item.id)}">Details</button>
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
    .sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || ""));

  $("#soldList").innerHTML = sales.length
    ? sales.map((sale) => {
        const item = data.items.find((entry) => entry.id === sale.itemId);
        if (!item) return "";

        return `
          <article class="item-row">
            ${thumbnail(item)}
            <div class="item-main">
              <div class="item-title">${escapeHtml(item.name)}</div>
              <div class="item-meta">
                <span>Paid: ${escapeHtml(formatDate(sale.paidDate || sale.saleDate))}</span>
                <span class="status-pill paid">Paid</span>
              </div>
            </div>
            <div class="item-price">
              <strong>${money(saleProfit(sale))}</strong>
              <span>Profit / loss</span>
              <button class="text-button" type="button"
                data-open-item="${escapeHtml(item.id)}">Details</button>
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
}

/* Navigation: do not reset the page scroll position. */

function showPage(pageName) {
  const validPages = ["home", "inventory", "add", "pending", "sold"];
  if (!validPages.includes(pageName)) return;

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === `page-${pageName}`);
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  $("#formMessage").textContent = "";
  $("#formMessage").classList.remove("error");
}

/* Adding inventory */

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");

    if (!file.type.startsWith("image/")) {
      return reject(new Error("Please choose an image file."));
    }

    if (file.size > 2 * 1024 * 1024) {
      return reject(new Error("Please choose an image smaller than 2 MB."));
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
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
    message.textContent = "Enter a name, valid purchase cost, and date.";
    message.classList.add("error");
    return;
  }

  const button = $("#itemForm").querySelector('[type="submit"]');
  button.disabled = true;

  try {
    const photo = await readPhoto($("#itemPhoto").files[0]);
    const category = $("#productCategory").value;
    const isCard = ["pokemon", "sports", "trading"].includes(category);
    const graded = isCard && $("#cardType").value === "graded";

    const item = {
      id: makeId(),
      name,
      productCategory: category,
      purchaseCost: Math.round(purchaseCost * 100) / 100,
      purchaseDate,
      itemCondition: $("#itemCondition").value,
      photo,
      notes: $("#itemNotes").value.trim(),
      cardType: isCard ? $("#cardType").value : "",
      gradingCompany: graded ? $("#gradingCompany").value : "",
      cardGrade: graded ? $("#cardGrade").value.trim() : "",
      certNumber: graded ? $("#certNumber").value.trim() : "",
      createdAt: new Date().toISOString()
    };

    data.items.push(item);

    if (!saveData()) {
      data.items = data.items.filter((entry) => entry.id !== item.id);
      return;
    }

    $("#itemForm").reset();
    $("#purchaseDate").value = todayString();
    updateCategoryOptions();
    setCardFieldsVisibility();

    renderAll();
    showPage("inventory");
    openItemDetails(item.id);
  } catch (error) {
    message.textContent = error.message || "Could not save the item.";
    message.classList.add("error");
  } finally {
    button.disabled = false;
  }
}

/* Compact item details */

function detailBox(label, value) {
  return `<div class="detail-box">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>`;
}

function openItemDetails(itemId) {
  const item = data.items.find((entry) => entry.id === itemId);
  if (!item) return;

  const sale = getSaleForItem(itemId);

  $("#detailsTitle").textContent = item.name;
  $("#detailsSubtitle").textContent =
    `${categoryName(item)} · ${formatDate(item.purchaseDate)}`;

  let html = '<div class="detail-grid">';

  html += detailBox("Purchase cost", money(item.purchaseCost));
  html += detailBox("Purchase date", formatDate(item.purchaseDate));
  html += detailBox("Category", categoryName(item));
  html += detailBox("Condition", item.itemCondition || "Not specified");

  if (isTradingCard(item)) {
    html += detailBox(
      "Card status",
      item.cardType === "graded" ? "Graded" : "Raw / ungraded"
    );

    if (item.cardType === "graded") {
      html += detailBox("Grading company", item.gradingCompany || "Not specified");
      html += detailBox("Grade", item.cardGrade || "Not specified");
      html += detailBox("Certification number", item.certNumber || "Not specified");
    }
  }

  html += "</div>";

  if (item.photo) {
    html += `<img class="details-photo"
      src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.name)}">`;
  }

  if (item.notes) {
    html += `<p class="details-notes">${escapeHtml(item.notes)}</p>`;
  }

  if (sale) {
    html += '<div class="detail-grid sale-detail-grid">';
    html += detailBox("Sale price", money(sale.salePrice));
    html += detailBox("Net proceeds", money(netProceeds(sale)));
    html += detailBox("Profit / loss", money(saleProfit(sale)));
    html += detailBox("Sale date", formatDate(sale.saleDate));
    html += detailBox("Payout", sale.status === "paid" ? "Paid" : "Pending");
    html += "</div>";

    if (sale.status === "pending") {
      html += `<div class="detail-actions">
        <button class="primary-button" type="button"
          data-mark-paid="${escapeHtml(sale.id)}">Mark as paid</button>
        <button class="danger-button" type="button"
          data-delete-sale="${escapeHtml(sale.id)}">Cancel sale</button>
      </div>`;
    }
  } else {
    html += `<div class="detail-actions">
      <button class="primary-button" type="button"
        data-start-sale="${escapeHtml(item.id)}">Record sale</button>
      <button class="secondary-button" type="button"
        data-duplicate-item="${escapeHtml(item.id)}">Duplicate item</button>
      <button class="danger-button" type="button"
        data-delete-item="${escapeHtml(item.id)}">Delete item</button>
    </div>`;
  }

  $("#detailsContent").innerHTML = html;
  $("#itemDetails").classList.remove("hidden");
}

function closeDetails() {
  $("#itemDetails").classList.add("hidden");
}

/* Sale form */

function showSaleForm(itemId) {
  const item = data.items.find((entry) => entry.id === itemId);
  if (!item || getSaleForItem(itemId)) return;

  $("#saleForm")?.remove();

  $("#detailsContent").insertAdjacentHTML("beforeend", `
    <form id="saleForm" class="sale-form">
      <h3>Record sale</h3>
      <div class="form-grid">
        <label class="field">Sale price ($) *
          <input name="salePrice" type="number" min="0" step="0.01" required>
        </label>
        <label class="field">Sale date *
          <input name="saleDate" type="date" value="${todayString()}" required>
        </label>
        <label class="field">Platform fees ($)
          <input name="platformFees" type="number" min="0" step="0.01" value="0" required>
        </label>
        <label class="field">Shipping ($)
          <input name="shipping" type="number" min="0" step="0.01" value="0" required>
        </label>
        <label class="field full-width">Other sale costs ($)
          <input name="otherCosts" type="number" min="0" step="0.01" value="0" required>
        </label>
      </div>
      <div class="sale-summary" id="saleEstimate">
        Enter a sale price to estimate proceeds and profit.
      </div>
      <div class="detail-actions">
        <button class="primary-button" type="submit">Save pending sale</button>
        <button class="secondary-button" type="button"
          data-cancel-sale-form="true">Cancel</button>
      </div>
      <p id="saleMessage" class="form-message" role="status"></p>
    </form>
  `);

  const form = $("#saleForm");

  function updateEstimate() {
    const values = new FormData(form);
    const net = Number(values.get("salePrice") || 0) -
      Number(values.get("platformFees") || 0) -
      Number(values.get("shipping") || 0) -
      Number(values.get("otherCosts") || 0);

    $("#saleEstimate").innerHTML = `
      Estimated net proceeds: <strong>${money(net)}</strong><br>
      Estimated profit / loss:
      <strong>${money(net - Number(item.purchaseCost))}</strong>`;
  }

  form.addEventListener("input", updateEstimate);
  form.addEventListener("submit", (event) => saveSale(event, itemId));
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
    data.sales = data.sales.filter((entry) => entry.id !== sale.id);
    return;
  }

  renderAll();
  openItemDetails(itemId);
}

/* Marking sales paid */

function markSalePaid(saleId) {
  const sale = data.sales.find((entry) => entry.id === saleId);
  if (!sale || sale.status !== "pending") return;

  const item = data.items.find((entry) => entry.id === sale.itemId);
  if (!item) return;

  const net = netProceeds(sale);
  const cost = Number(item.purchaseCost) || 0;
  const recovered = Math.max(0, Math.min(net, cost));
  const profit = Math.max(0, net - cost);
  const reinvestment = Math.round(profit * 50) / 100;
  const personal = profit - reinvestment;

  const oldFunds = { ...data.funds };
  const oldSale = { ...sale };

  data.funds.capital += recovered;
  data.funds.reinvestment += reinvestment;
  data.funds.personal += personal;

  sale.status = "paid";
  sale.paidDate = todayString();
  sale.paidAt = new Date().toISOString();
  sale.capitalRecovered = recovered;
  sale.reinvestmentAdded = reinvestment;
  sale.personalAdded = personal;

  if (!saveData()) {
    data.funds = oldFunds;
    Object.assign(sale, oldSale);
    return;
  }

  renderAll();
  openItemDetails(item.id);
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

  renderAll();
  openItemDetails(sale.itemId);
}

function duplicateItem(itemId) {
  const original = data.items.find((entry) => entry.id === itemId);
  if (!original) return;

  const copy = {
    ...original,
    id: makeId(),
    createdAt: new Date().toISOString()
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
    alert("Cancel the pending sale first. Items with sales cannot be deleted.");
    return;
  }

  if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;

  data.items = data.items.filter((entry) => entry.id !== itemId);

  if (!saveData()) {
    data.items.push(item);
    return;
  }

  closeDetails();
  renderAll();
}

/* Buttons */

document.addEventListener("click", (event) => {
  const target = event.target;

  const pageButton = target.closest("[data-page]");
  if (pageButton) return showPage(pageButton.dataset.page);

  const goButton = target.closest("[data-go]");
  if (goButton) return showPage(goButton.dataset.go);

  const openButton = target.closest("[data-open-item]");
  if (openButton) return openItemDetails(openButton.dataset.openItem);

  const saleButton = target.closest("[data-start-sale]");
  if (saleButton) return showSaleForm(saleButton.dataset.startSale);

  const paidButton = target.closest("[data-mark-paid]");
  if (paidButton) return markSalePaid(paidButton.dataset.markPaid);

  const cancelButton = target.closest("[data-delete-sale]");
  if (cancelButton) return cancelSale(cancelButton.dataset.deleteSale);

  const duplicateButton = target.closest("[data-duplicate-item]");
  if (duplicateButton) return duplicateItem(duplicateButton.dataset.duplicateItem);

  const deleteButton = target.closest("[data-delete-item]");
  if (deleteButton) return deleteItem(deleteButton.dataset.deleteItem);

  if (target.closest("[data-cancel-sale-form]")) {
    $("#saleForm")?.remove();
  }
});

$("#quickAddButton").addEventListener("click", () => showPage("add"));
$("#closeDetails").addEventListener("click", closeDetails);
$("#itemForm").addEventListener("submit", addItem);
$("#productCategory").addEventListener("change", () => {
  if ($("#productCategory").value === "__add_custom__") {
    createCustomCategory();
  } else {
    setCardFieldsVisibility();
  }
});
$("#cardType").addEventListener("change", setGradingFieldsVisibility);
$("#inventorySearch").addEventListener("input", renderInventory);
$("#categoryFilter").addEventListener("change", renderInventory);

updateCategoryOptions();
$("#purchaseDate").value = todayString();
setCardFieldsVisibility();
renderAll();
