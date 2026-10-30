"use strict";

/* =========================================
   CACHE — APPLICATION
========================================= */

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
    alert("Could not save. Your browser storage may be full. Try smaller photos.");
    console.error(error);
    return false;
  }
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

  return item
    ? netProceeds(sale) - Number(item.purchaseCost || 0)
    : 0;
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
    (total, item) => total + Number(item.purchaseCost || 0),
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
    return `
      <div class="item-thumbnail">
        <img src="${escapeHtml(item.photo)}"
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
          ${money(sale ? netProceeds(sale) : item.purchaseCost)}
        </strong>

        <span>${sale ? "Net proceeds" : "Purchase cost"}</span>

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
            <strong>${money(saleProfit(sale))}</strong>
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
}

/* =========================================
   NAVIGATION
========================================= */

function showPage(pageName) {
  if (!["home", "inventory", "add", "pending", "sold"].includes(pageName)) {
    return;
  }

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle(
      "active",
      page.id === `page-${pageName}`
    );
  });

  document.querySelectorAll(".nav-button, .sidebar-link").forEach((button) => {
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
    sold: "Completed sales"
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

    if (file.size > 2 * 1024 * 1024) {
      return reject(new Error("Please choose an image smaller than 2 MB."));
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the image."));

    reader.readAsDataURL(file);
  });
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

  const message = $("#formMessage");

  message.textContent = "";
  message.classList.remove("error");

  const name = $("#itemName").value.trim();
  const purchaseCost = Number($("#purchaseCost").value);
  const purchaseDate = $("#purchaseDate").value;
     if (!name || !purchaseDate ||
      !Number.isFinite(purchaseCost) || purchaseCost < 0) {
    message.textContent =
      "Enter a name, valid purchase cost, and date.";

    message.classList.add("error");
    return;
  }

  const button = form.querySelector('[type="submit"]');
  button.disabled = true;

  try {
    const selectedFile = $("#itemPhoto").files[0];

    const newPhoto = selectedFile
      ? await readPhoto(selectedFile)
      : null;

    const category = $("#productCategory").value;

    const isCard = [
      "pokemon", "sports", "trading"
    ].includes(category);

    const graded = isCard && $("#cardType").value === "graded";

    const item = {
      ...(existing || {}),
      id: existing ? existing.id : makeId(),
      name,
      productCategory: category,
      purchaseCost: Math.round(purchaseCost * 100) / 100,
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

    if (index >= 0) {
      data.items[index] = item;
    } else {
      data.items.push(item);
    }

    if (!saveData()) {
      if (existing && index >= 0) {
        data.items[index] = existing;
      } else {
        data.items = data.items.filter(
          (entry) => entry.id !== item.id
        );
      }

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
  $("#purchaseCost").value = item.purchaseCost;
  $("#purchaseDate").value = item.purchaseDate;

  $("#itemCondition").value =
    item.itemCondition || "Not specified";

  $("#itemNotes").value = item.notes || "";
  $("#cardType").value = item.cardType || "raw";
  $("#gradingCompany").value = item.gradingCompany || "";
  $("#cardGrade").value = item.cardGrade || "";
  $("#certNumber").value = item.certNumber || "";
  $("#itemPhoto").value = "";

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

  html += detailBox("Purchase cost", money(item.purchaseCost));
  html += detailBox("Purchase date", formatDate(item.purchaseDate));
  html += detailBox("Category", categoryName(item));

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
    html += `
      <img class="details-photo"
        src="${escapeHtml(item.photo)}"
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
    html += detailBox("Profit / loss", money(saleProfit(sale)));
    html += detailBox("Sale date", formatDate(sale.saleDate));

    html += detailBox(
      "Payout",
      sale.status === "paid" ? "Paid" : "Pending"
    );

    html += "</div>";

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

  form.addEventListener("submit", (event) => {
    saveSale(event, itemId);
  });
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

/* =========================================
   INITIALIZE
========================================= */

updateCategoryOptions();

$("#purchaseDate").value = todayString();

setCardFieldsVisibility();

renderAll();
