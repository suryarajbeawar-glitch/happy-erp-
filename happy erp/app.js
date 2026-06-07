const DB_NAME = "kapdaDukanErp";
const DB_VERSION = 1;
const STORE_NAMES = [
  "products",
  "customers",
  "suppliers",
  "bills",
  "purchases",
  "expenses",
  "ledger",
  "users",
  "settings"
];

const categories = ["Shirt", "T-Shirt", "Jeans", "Trouser", "Kurta", "Blazer"];
const sizes = ["S", "M", "L", "XL", "XXL"];
const expenseCategories = ["Rent", "Salary", "Electricity", "Internet", "Transport", "Miscellaneous"];
const lowStockLimit = 5;

let db;
let state = {
  products: [],
  customers: [],
  suppliers: [],
  bills: [],
  purchases: [],
  expenses: [],
  ledger: [],
  users: [],
  currentBill: [],
  editingBillId: null,
  stockFilter: "all",
  selectedInvoice: null
};

const el = (id) => document.getElementById(id);
const money = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthKey = () => new Date().toISOString().slice(0, 7);
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
const sum = (items, selector) => items.reduce((total, item) => total + Number(selector(item) || 0), 0);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  db = await openDb();
  await seedIfNeeded();
  await refreshState();
  setupStaticOptions();
  bindEvents();
  resetBill();
  renderAll();
  registerServiceWorker();
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      STORE_NAMES.forEach((name) => {
        if (!database.objectStoreNames.contains(name)) {
          database.createObjectStore(name, { keyPath: "id" });
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(name, mode = "readonly") {
  return db.transaction(name, mode).objectStore(name);
}

function getAll(name) {
  return new Promise((resolve, reject) => {
    const request = txStore(name).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function put(name, value) {
  return new Promise((resolve, reject) => {
    const request = txStore(name, "readwrite").put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

function remove(name, id) {
  return new Promise((resolve, reject) => {
    const request = txStore(name, "readwrite").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearStore(name) {
  return new Promise((resolve, reject) => {
    const request = txStore(name, "readwrite").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function seedIfNeeded() {
  const existing = await getAll("settings");
  if (existing.some((item) => item.id === "seeded")) return;

  const products = [
    product("Cotton Casual Shirt", "Shirt", "Raymond", "M", "Blue", "8901001", 520, 899, 5, 18),
    product("Slim Fit Jeans", "Jeans", "DenimCo", "L", "Black", "8901002", 780, 1499, 12, 9),
    product("Printed T-Shirt", "T-Shirt", "UrbanWear", "XL", "White", "8901003", 260, 599, 5, 4),
    product("Formal Trouser", "Trouser", "Classic", "M", "Grey", "8901004", 620, 1199, 12, 0),
    product("Festive Kurta", "Kurta", "EthnicPlus", "L", "Maroon", "8901005", 700, 1599, 5, 12),
    product("Party Blazer", "Blazer", "Elite", "XL", "Navy", "8901006", 2200, 3999, 12, 2)
  ];
  const customers = [
    { id: uid("cus"), name: "Rahul Sharma", mobile: "9876543210", address: "Main Bazaar" },
    { id: uid("cus"), name: "Priya Verma", mobile: "9123456780", address: "Station Road" }
  ];
  const suppliers = [
    { id: uid("sup"), name: "Metro Garments", mobile: "9000011111", address: "Wholesale Market", gst: "27ABCDE1234F1Z5" },
    { id: uid("sup"), name: "Style Distributors", mobile: "9000022222", address: "Ring Road", gst: "27PQRSX9876H1Z3" }
  ];
  const users = [
    { id: uid("usr"), name: "Owner", role: "Owner", permissions: ["Billing", "Edit Bill", "Delete Bill", "Reports", "Stock"] },
    { id: uid("usr"), name: "Manager", role: "Manager", permissions: ["Billing", "Edit Bill", "Reports", "Stock"] },
    { id: uid("usr"), name: "Staff", role: "Staff", permissions: ["Billing"] }
  ];

  for (const item of products) await put("products", item);
  for (const item of customers) await put("customers", item);
  for (const item of suppliers) await put("suppliers", item);
  for (const item of users) await put("users", item);
  await put("expenses", { id: uid("exp"), date: today(), category: "Electricity", amount: 1200, notes: "Monthly bill" });
  await put("settings", { id: "seeded", value: true });
}

function product(name, category, brand, size, color, barcode, purchaseRate, saleRate, gst, stock) {
  return {
    id: uid("prd"),
    name,
    category,
    brand,
    size,
    color,
    barcode,
    purchaseRate,
    saleRate,
    gst,
    stock,
    openingStock: stock,
    lastSold: null
  };
}

async function refreshState() {
  for (const name of STORE_NAMES.filter((item) => item !== "settings")) {
    state[name] = await getAll(name);
  }
}

function setupStaticOptions() {
  fillSelect(el("productCategory"), categories.map((item) => [item, item]));
  fillSelect(el("productSize"), sizes.map((item) => [item, item]));
  fillSelect(el("expenseCategory"), expenseCategories.map((item) => [item, item]));
  el("purchaseDate").value = today();
  el("expenseDate").value = today();
  el("reportDate").value = today();
  el("reportMonth").value = monthKey();
}

function bindEvents() {
  document.querySelectorAll("[data-view], [data-view-target]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view || button.dataset.viewTarget));
  });
  el("sidebarToggle").addEventListener("click", toggleSidebar);
  el("themeToggle").addEventListener("click", toggleTheme);
  el("productSearch").addEventListener("input", renderSuggestions);
  el("barcodeInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const found = state.products.find((item) => item.barcode === el("barcodeInput").value.trim());
      if (found) addBillItem(found.id);
      el("barcodeInput").value = "";
    }
  });

  ["billDiscountPercent", "billDiscountAmount", "billGst", "billExtra", "billRoundOff", "payCash", "payUpi", "payBank", "payCard", "payCreditNote", "paySalesReturn", "payCredit"].forEach((id) => {
    el(id).addEventListener("input", renderBill);
    el(id).addEventListener("change", renderBill);
  });
  document.querySelectorAll("[data-report-tab]").forEach((button) => {
    button.addEventListener("click", () => showReportTab(button.dataset.reportTab));
  });

  el("saveBillBtn").addEventListener("click", saveBill);
  el("productForm").addEventListener("submit", saveProduct);
  el("resetProduct").addEventListener("click", resetProductForm);
  el("stockSearch").addEventListener("input", renderStock);
  document.querySelectorAll("[data-stock-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.stockFilter = button.dataset.stockFilter;
      document.querySelectorAll("[data-stock-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderStock();
    });
  });
  el("purchaseForm").addEventListener("submit", savePurchase);
  el("customerForm").addEventListener("submit", saveCustomer);
  el("supplierForm").addEventListener("submit", saveSupplier);
  el("expenseForm").addEventListener("submit", saveExpense);
  ["billFilter", "billDateFilter", "customerSearch", "supplierSearch", "reportDate", "reportMonth"].forEach((id) => {
    el(id).addEventListener("input", renderAll);
    el(id).addEventListener("change", renderAll);
  });
  el("exportData").addEventListener("click", exportData);
  el("importData").addEventListener("change", importData);
  el("exportProductsCsv").addEventListener("click", () => downloadCsv("products.csv", state.products));
  el("exportReportCsv").addEventListener("click", exportReportCsv);
  el("printReports").addEventListener("click", () => window.print());
  el("googleDriveBackup").addEventListener("click", () => {
    exportData();
    toast("Backup file ready. Upload it to Google Drive or connect Drive API.");
  });
  el("closeInvoice").addEventListener("click", () => el("invoiceDialog").close());
  el("printInvoice").addEventListener("click", () => window.print());
  el("downloadInvoice").addEventListener("click", downloadInvoice);
  el("whatsappInvoice").addEventListener("click", sendInvoiceWhatsapp);
}

function fillSelect(select, values, placeholder) {
  select.innerHTML = "";
  if (placeholder) select.append(new Option(placeholder, ""));
  values.forEach(([value, label]) => select.append(new Option(label, value)));
}

function showView(view) {
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  el(view).classList.add("active");
  el("pageTitle").textContent = view[0].toUpperCase() + view.slice(1);
  renderAll();
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("kapda-theme", document.body.classList.contains("dark") ? "dark" : "light");
}

function toggleSidebar() {
  const shell = document.querySelector(".app-shell");
  shell.classList.toggle("sidebar-collapsed");
  localStorage.setItem("happy-sidebar", shell.classList.contains("sidebar-collapsed") ? "collapsed" : "open");
}

function showReportTab(tabId) {
  document.querySelectorAll("[data-report-tab]").forEach((button) => button.classList.toggle("active", button.dataset.reportTab === tabId));
  document.querySelectorAll(".report-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
}

function renderAll() {
  renderSelects();
  renderDashboard();
  renderBill();
  renderBills();
  renderStock();
  renderPurchases();
  renderCustomers();
  renderSuppliers();
  renderExpenses();
  renderAccounts();
  renderReports();
  renderUsers();
}

function renderSelects() {
  fillSelect(el("billCustomer"), state.customers.map((item) => [item.id, `${item.name} (${item.mobile})`]), "Walk-in Customer");
  fillSelect(el("purchaseSupplier"), state.suppliers.map((item) => [item.id, item.name]));
  fillSelect(el("purchaseProduct"), state.products.map((item) => [item.id, `${item.name} - ${item.size}/${item.color}`]));
}

function getMetrics() {
  const todayBills = state.bills.filter((bill) => bill.date === today());
  const monthBills = state.bills.filter((bill) => bill.date.startsWith(monthKey()));
  const yearBills = state.bills.filter((bill) => bill.date.startsWith(today().slice(0, 4)));
  const paidBy = (mode) => sum(state.bills, (bill) => bill.payments?.[mode]);
  const purchaseMonth = sum(state.purchases.filter((item) => item.date.startsWith(monthKey())), (item) => item.total);
  const outputGst = sum(state.bills, (bill) => bill.gst);
  const inputGst = sum(state.purchases, (purchase) => purchase.total - (purchase.total / (1 + Number(purchase.gst || 0) / 100)));
  const expensesToday = sum(state.expenses.filter((item) => item.date === today()), (item) => item.amount);
  const profit = sum(state.bills, (bill) => bill.profit) - sum(state.expenses, (item) => item.amount);
  return {
    todaySale: sum(todayBills, (bill) => bill.total),
    monthlySale: sum(monthBills, (bill) => bill.total),
    yearlySale: sum(yearBills, (bill) => bill.total),
    profit,
    cash: paidBy("cash"),
    upi: paidBy("upi"),
    bank: paidBy("bank"),
    card: paidBy("card"),
    creditNote: paidBy("creditNote"),
    salesReturn: paidBy("salesReturn"),
    credit: paidBy("credit"),
    pending: paidBy("credit"),
    customers: state.customers.length,
    products: state.products.length,
    lowStock: state.products.filter((item) => item.stock > 0 && item.stock <= lowStockLimit).length,
    outStock: state.products.filter((item) => item.stock <= 0).length,
    expensesToday,
    purchaseMonth,
    outputGst,
    inputGst,
    gstPayable: outputGst - inputGst
  };
}

function renderDashboard() {
  const metrics = getMetrics();
  const cards = [
    ["Today's Sale", money(metrics.todaySale), "Daily counter total"],
    ["Monthly Sale", money(metrics.monthlySale), "Current month"],
    ["Total Profit", money(metrics.profit), "After expenses"],
    ["Cash In Hand", money(metrics.cash), "Cash account"],
    ["UPI Collection", money(metrics.upi), "UPI account"],
    ["Bank Collection", money(metrics.bank), "Bank transfer"],
    ["Credit Notes", money(metrics.creditNote), "Adjusted against sales"],
    ["Sales Returns", money(metrics.salesReturn), "Return settlement"],
    ["Credit Sale", money(metrics.credit), "Outstanding sales"],
    ["Pending Payment", money(metrics.pending), "Customer dues"],
    ["Total Customers", metrics.customers, "Saved customers"],
    ["Total Products", metrics.products, "Active products"],
    ["Low Stock Products", metrics.lowStock, "Needs purchase"],
    ["Out of Stock Products", metrics.outStock, "Unavailable"]
  ];
  el("dashboardCards").innerHTML = cards.map(([label, value, hint]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`).join("");
  drawCharts();
}

function drawCharts() {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
  drawBarChart("dailySalesChart", days.map((date) => ({ label: date.slice(5), value: sum(state.bills.filter((bill) => bill.date === date), (bill) => bill.total) })), "#0f766e");
  const months = Array.from({ length: 12 }, (_, index) => `${today().slice(0, 4)}-${String(index + 1).padStart(2, "0")}`);
  drawBarChart("monthlySalesChart", months.map((date) => ({ label: date.slice(5), value: sum(state.bills.filter((bill) => bill.date.startsWith(date)), (bill) => bill.total) })), "#b45309");
  const metrics = getMetrics();
  drawBarChart("paymentChart", [
    { label: "Cash", value: metrics.cash },
    { label: "UPI", value: metrics.upi },
    { label: "Bank", value: metrics.bank },
    { label: "Card", value: metrics.card },
    { label: "Credit", value: metrics.credit }
  ], "#2563eb");
  drawBarChart("profitChart", months.map((date) => {
    const bills = state.bills.filter((bill) => bill.date.startsWith(date));
    const expenses = state.expenses.filter((item) => item.date.startsWith(date));
    return { label: date.slice(5), value: sum(bills, (bill) => bill.profit) - sum(expenses, (item) => item.amount) };
  }), "#15803d");
  drawGroupedBarChart("salesPurchaseChart", months.map((date) => ({
    label: date.slice(5),
    sale: sum(state.bills.filter((bill) => bill.date.startsWith(date)), (bill) => bill.total),
    purchase: sum(state.purchases.filter((purchase) => purchase.date.startsWith(date)), (purchase) => purchase.total)
  })));
  drawBarChart("gstChart", [
    { label: "Output", value: metrics.outputGst },
    { label: "Input", value: metrics.inputGst },
    { label: "Payable", value: Math.max(0, metrics.gstPayable) },
    { label: "Credit", value: Math.max(0, -metrics.gstPayable) }
  ], "#7c3aed");
}

function drawGroupedBarChart(id, data) {
  const canvas = el(id);
  const ctx = canvas.getContext("2d");
  const width = canvas.clientWidth || 500;
  const height = Number(canvas.getAttribute("height")) || 210;
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);
  const max = Math.max(...data.flatMap((item) => [item.sale, item.purchase]), 1);
  const gap = 10;
  const groupWidth = Math.max(28, (width - gap * (data.length + 1)) / data.length);
  const barWidth = Math.max(8, (groupWidth - 4) / 2);
  ctx.font = "12px sans-serif";
  data.forEach((item, index) => {
    const x = gap + index * (groupWidth + gap);
    const saleHeight = Math.max(3, (item.sale / max) * (height - 54));
    const purchaseHeight = Math.max(3, (item.purchase / max) * (height - 54));
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(x, height - 30 - saleHeight, barWidth, saleHeight);
    ctx.fillStyle = "#b45309";
    ctx.fillRect(x + barWidth + 4, height - 30 - purchaseHeight, barWidth, purchaseHeight);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--muted");
    ctx.fillText(item.label, x, height - 8);
  });
}

function drawBarChart(id, data, color) {
  const canvas = el(id);
  const ctx = canvas.getContext("2d");
  const width = canvas.clientWidth || 500;
  const height = Number(canvas.getAttribute("height")) || 190;
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);
  const max = Math.max(...data.map((item) => item.value), 1);
  const gap = 10;
  const barWidth = Math.max(18, (width - gap * (data.length + 1)) / data.length);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--muted");
  ctx.font = "12px sans-serif";
  data.forEach((item, index) => {
    const x = gap + index * (barWidth + gap);
    const barHeight = Math.max(3, (Math.abs(item.value) / max) * (height - 50));
    const y = height - 28 - barHeight;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--muted");
    ctx.fillText(item.label, x, height - 8);
  });
}

function resetBill() {
  state.currentBill = [];
  state.editingBillId = null;
  ["billDiscountPercent", "billDiscountAmount", "billGst", "billExtra", "payCash", "payUpi", "payBank", "payCard", "payCreditNote", "paySalesReturn", "payCredit"].forEach((id) => el(id).value = 0);
  el("billRoundOff").checked = true;
  el("billNotes").value = "";
  el("billNoLabel").textContent = `Bill No: ${nextBillNo()}`;
  renderBill();
}

function nextBillNo() {
  return `INV-${String(state.bills.length + 1).padStart(4, "0")}`;
}

function renderSuggestions() {
  const query = el("productSearch").value.toLowerCase().trim();
  const matches = state.products.filter((item) => {
    const text = `${item.name} ${item.brand} ${item.category} ${item.size} ${item.color} ${item.barcode}`.toLowerCase();
    return query && text.includes(query);
  }).slice(0, 6);
  el("productSuggestions").innerHTML = matches.map((item) => `
    <button class="suggestion" onclick="addBillItem('${item.id}')">
      <strong>${item.name}</strong>
      <span>${item.brand} • ${item.size}/${item.color} • Stock ${item.stock} • ${money(item.saleRate)}</span>
      <mark>${item.barcode}</mark>
    </button>
  `).join("");
}

window.addBillItem = function addBillItem(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  if (product.stock <= 0) {
    toast("Product out of stock.");
    return;
  }
  const existing = state.currentBill.find((item) => item.productId === productId);
  if (existing) existing.qty += 1;
  else state.currentBill.push({ productId, qty: 1, rate: product.saleRate, discount: 0, gst: product.gst });
  el("productSearch").value = "";
  el("productSuggestions").innerHTML = "";
  renderBill();
};

window.updateBillItem = function updateBillItem(index, field, value) {
  state.currentBill[index][field] = Number(value || 0);
  renderBill();
};

window.removeBillItem = function removeBillItem(index) {
  state.currentBill.splice(index, 1);
  renderBill();
};

function calculateBill() {
  const itemRows = state.currentBill.map((line) => {
    const product = state.products.find((item) => item.id === line.productId);
    const base = line.qty * line.rate;
    const discount = Number(line.discount || 0);
    const taxable = Math.max(0, base - discount);
    const gst = taxable * Number(line.gst || 0) / 100;
    const total = taxable + gst;
    const cost = line.qty * Number(product?.purchaseRate || 0);
    return { ...line, product, base, discount, taxable, gstAmount: gst, total, cost, profit: total - cost };
  });
  const subtotal = sum(itemRows, (item) => item.base);
  const itemDiscount = sum(itemRows, (item) => item.discount);
  const billDiscountPercent = Number(el("billDiscountPercent").value || 0);
  const billDiscountAmount = Number(el("billDiscountAmount").value || 0);
  const billDiscount = (subtotal - itemDiscount) * billDiscountPercent / 100 + billDiscountAmount;
  const itemGst = sum(itemRows, (item) => item.gstAmount);
  const billGst = Math.max(0, subtotal - itemDiscount - billDiscount) * Number(el("billGst").value || 0) / 100;
  const extra = Number(el("billExtra").value || 0);
  const rawTotal = Math.max(0, subtotal - itemDiscount - billDiscount + itemGst + billGst + extra);
  const total = el("billRoundOff").checked ? Math.round(rawTotal) : rawTotal;
  const roundOff = total - rawTotal;
  const payments = {
    cash: Number(el("payCash").value || 0),
    upi: Number(el("payUpi").value || 0),
    bank: Number(el("payBank").value || 0),
    card: Number(el("payCard").value || 0),
    creditNote: Number(el("payCreditNote").value || 0),
    salesReturn: Number(el("paySalesReturn").value || 0),
    credit: Number(el("payCredit").value || 0)
  };
  const paid = sum(Object.values(payments), (item) => item);
  const profit = sum(itemRows, (item) => item.profit) - billDiscount + extra;
  return { itemRows, subtotal, itemDiscount, billDiscount, itemGst, billGst, extra, rawTotal, total, roundOff, payments, paid, profit };
}

function renderBill() {
  const calc = calculateBill();
  el("posMetrics").innerHTML = `
    <div class="pos-pill"><span>Items</span><strong>${sum(calc.itemRows, (item) => item.qty)}</strong></div>
    <div class="pos-pill"><span>Bill Total</span><strong>${money(calc.total)}</strong></div>
    <div class="pos-pill"><span>Paid</span><strong>${money(calc.paid)}</strong></div>
    <div class="pos-pill"><span>Balance</span><strong>${money(calc.total - calc.paid)}</strong></div>
  `;
  el("billItems").innerHTML = calc.itemRows.map((line, index) => `
    <tr>
      <td><strong>${line.product?.name || "Product"}</strong><br><small>${line.product?.brand || ""} ${line.product?.size || ""}/${line.product?.color || ""}</small></td>
      <td><input type="number" min="1" value="${line.qty}" onchange="updateBillItem(${index}, 'qty', this.value)"></td>
      <td><input type="number" min="0" value="${line.rate}" onchange="updateBillItem(${index}, 'rate', this.value)"></td>
      <td><input type="number" min="0" value="${line.discount}" onchange="updateBillItem(${index}, 'discount', this.value)"></td>
      <td><input type="number" min="0" value="${line.gst}" onchange="updateBillItem(${index}, 'gst', this.value)"></td>
      <td>${money(line.total)}</td>
      <td><button class="mini-btn danger" onclick="removeBillItem(${index})">Remove</button></td>
    </tr>
  `).join("") || `<tr><td colspan="7">Search or scan product to start billing.</td></tr>`;
  el("amountLines").innerHTML = `
    <div class="amount-line"><span>Subtotal</span><strong>${money(calc.subtotal)}</strong></div>
    <div class="amount-line"><span>Discount</span><strong>${money(calc.itemDiscount + calc.billDiscount)}</strong></div>
    <div class="amount-line"><span>GST</span><strong>${money(calc.itemGst + calc.billGst)}</strong></div>
    <div class="amount-line"><span>Extra</span><strong>${money(calc.extra)}</strong></div>
    <div class="amount-line"><span>Round Off</span><strong>${money(calc.roundOff)}</strong></div>
    <div class="amount-line total"><span>Total</span><strong>${money(calc.total)}</strong></div>
    <div class="amount-line"><span>Paid</span><strong>${money(calc.paid)}</strong></div>
    <div class="amount-line"><span>Balance</span><strong>${money(calc.total - calc.paid)}</strong></div>
  `;
}

async function saveBill() {
  const calc = calculateBill();
  if (!state.currentBill.length) return toast("Please add at least one product.");
  if (calc.paid !== calc.total) return toast("Payment total must match bill total. Use Credit for pending amount.");
  for (const line of calc.itemRows) {
    if (!state.editingBillId && line.qty > line.product.stock) return toast(`${line.product.name} stock is not enough.`);
  }

  if (state.editingBillId) await reverseBillStock(state.bills.find((bill) => bill.id === state.editingBillId));

  const bill = {
    id: state.editingBillId || uid("bill"),
    billNo: state.editingBillId ? state.bills.find((item) => item.id === state.editingBillId).billNo : nextBillNo(),
    date: today(),
    time: new Date().toLocaleTimeString("en-IN"),
    customerId: el("billCustomer").value,
    notes: el("billNotes").value,
    items: calc.itemRows.map((line) => ({
      productId: line.productId,
      name: line.product.name,
      brand: line.product.brand,
      size: line.product.size,
      color: line.product.color,
      qty: line.qty,
      rate: line.rate,
      discount: line.discount,
      gst: line.gst,
      total: line.total,
      cost: line.cost
    })),
    subtotal: calc.subtotal,
    discount: calc.itemDiscount + calc.billDiscount,
    gst: calc.itemGst + calc.billGst,
    extra: calc.extra,
    roundOff: calc.roundOff,
    total: calc.total,
    payments: calc.payments,
    profit: calc.profit
  };
  await put("bills", bill);
  await applyBillStock(bill, -1);
  await rebuildLedger();
  await refreshState();
  state.selectedInvoice = bill;
  showInvoice(bill.id);
  resetBill();
  renderAll();
  toast("Bill saved and stock/accounts updated.");
}

async function applyBillStock(bill, direction) {
  for (const line of bill.items) {
    const product = state.products.find((item) => item.id === line.productId);
    if (!product) continue;
    product.stock += direction * line.qty;
    if (direction < 0) product.lastSold = bill.date;
    await put("products", product);
  }
}

async function reverseBillStock(bill) {
  if (bill) await applyBillStock(bill, 1);
}

async function saveProduct(event) {
  event.preventDefault();
  const id = el("productId").value || uid("prd");
  const item = {
    id,
    name: el("productName").value.trim(),
    category: el("productCategory").value,
    brand: el("productBrand").value.trim(),
    size: el("productSize").value,
    color: el("productColor").value.trim(),
    barcode: el("productBarcode").value.trim(),
    purchaseRate: Number(el("productPurchase").value),
    saleRate: Number(el("productSale").value),
    gst: Number(el("productGst").value),
    stock: Number(el("productStock").value),
    openingStock: Number(el("productStock").value),
    lastSold: state.products.find((product) => product.id === id)?.lastSold || null
  };
  await put("products", item);
  await refreshState();
  resetProductForm();
  renderAll();
  toast("Product saved.");
}

function resetProductForm() {
  el("productForm").reset();
  el("productId").value = "";
  el("productGst").value = 5;
}

window.editProduct = function editProduct(id) {
  const item = state.products.find((product) => product.id === id);
  if (!item) return;
  el("productId").value = item.id;
  el("productName").value = item.name;
  el("productCategory").value = item.category;
  el("productBrand").value = item.brand;
  el("productSize").value = item.size;
  el("productColor").value = item.color;
  el("productBarcode").value = item.barcode;
  el("productPurchase").value = item.purchaseRate;
  el("productSale").value = item.saleRate;
  el("productGst").value = item.gst;
  el("productStock").value = item.stock;
};

function renderStock() {
  const query = el("stockSearch").value?.toLowerCase() || "";
  let items = state.products.filter((item) => `${item.name} ${item.brand} ${item.category} ${item.barcode} ${item.color}`.toLowerCase().includes(query));
  if (state.stockFilter === "low") items = items.filter((item) => item.stock > 0 && item.stock <= lowStockLimit);
  if (state.stockFilter === "out") items = items.filter((item) => item.stock <= 0);
  if (state.stockFilter === "dead") items = items.filter((item) => !item.lastSold && item.openingStock > 0);
  el("stockTable").innerHTML = items.map((item) => `
    <tr>
      <td><strong>${item.name}</strong><br><small>${item.brand}</small></td>
      <td>${item.category} • ${item.size} • ${item.color}</td>
      <td>${item.barcode}</td>
      <td class="${item.stock <= 0 ? "danger" : ""}">${item.stock}</td>
      <td>${money(item.saleRate)}</td>
      <td><button class="mini-btn" onclick="editProduct('${item.id}')">Edit</button> <button class="mini-btn" onclick="printBarcode('${item.id}')">Label</button></td>
    </tr>
  `).join("") || `<tr><td colspan="6">No stock found.</td></tr>`;
}

window.printBarcode = function printBarcode(id) {
  const item = state.products.find((product) => product.id === id);
  if (!item) return;
  const html = `<div class="invoice"><h2>${item.name}</h2><p>${item.brand} ${item.size}/${item.color}</p><div class="qr-box">${item.barcode}</div><p>${money(item.saleRate)}</p></div>`;
  el("invoiceContent").innerHTML = html;
  el("invoiceDialog").showModal();
};

async function savePurchase(event) {
  event.preventDefault();
  const product = state.products.find((item) => item.id === el("purchaseProduct").value);
  const supplier = state.suppliers.find((item) => item.id === el("purchaseSupplier").value);
  const qty = Number(el("purchaseQty").value);
  const rate = Number(el("purchaseRate").value || product.purchaseRate);
  const gst = Number(el("purchaseGst").value);
  const total = qty * rate * (1 + gst / 100);
  const purchase = {
    id: uid("pur"),
    supplierId: supplier.id,
    invoice: el("purchaseInvoice").value,
    date: el("purchaseDate").value,
    productId: product.id,
    productName: product.name,
    qty,
    rate,
    gst,
    total
  };
  product.stock += qty;
  product.purchaseRate = rate;
  await put("products", product);
  await put("purchases", purchase);
  await rebuildLedger();
  await refreshState();
  el("purchaseForm").reset();
  el("purchaseDate").value = today();
  renderAll();
  toast("Purchase saved and stock increased.");
}

function renderPurchases() {
  el("purchaseTotalLabel").textContent = `Total: ${money(sum(state.purchases, (item) => item.total))}`;
  el("purchaseTable").innerHTML = state.purchases.slice().reverse().map((item) => {
    const supplier = state.suppliers.find((sup) => sup.id === item.supplierId);
    return `<tr><td>${item.invoice}</td><td>${item.date}</td><td>${supplier?.name || "-"}</td><td>${item.productName}</td><td>${item.qty}</td><td>${money(item.total)}</td></tr>`;
  }).join("") || `<tr><td colspan="6">No purchases yet.</td></tr>`;
}

async function saveCustomer(event) {
  event.preventDefault();
  const item = {
    id: el("customerId").value || uid("cus"),
    name: el("customerName").value.trim(),
    mobile: el("customerMobile").value.trim(),
    address: el("customerAddress").value.trim()
  };
  await put("customers", item);
  await refreshState();
  el("customerForm").reset();
  renderAll();
  toast("Customer saved.");
}

function renderCustomers() {
  const query = el("customerSearch").value?.toLowerCase() || "";
  const rows = state.customers.filter((item) => `${item.name} ${item.mobile}`.toLowerCase().includes(query));
  el("customerTable").innerHTML = rows.map((item) => {
    const bills = state.bills.filter((bill) => bill.customerId === item.id);
    return `<tr><td>${item.name}</td><td>${item.mobile}</td><td>${money(sum(bills, (bill) => bill.total))}</td><td>${money(sum(bills, (bill) => bill.payments.credit))}</td><td><button class="mini-btn" onclick="editCustomer('${item.id}')">Edit</button></td></tr>`;
  }).join("") || `<tr><td colspan="5">No customers found.</td></tr>`;
}

window.editCustomer = function editCustomer(id) {
  const item = state.customers.find((customer) => customer.id === id);
  el("customerId").value = item.id;
  el("customerName").value = item.name;
  el("customerMobile").value = item.mobile;
  el("customerAddress").value = item.address;
};

async function saveSupplier(event) {
  event.preventDefault();
  const item = {
    id: el("supplierId").value || uid("sup"),
    name: el("supplierName").value.trim(),
    mobile: el("supplierMobile").value.trim(),
    address: el("supplierAddress").value.trim(),
    gst: el("supplierGst").value.trim()
  };
  await put("suppliers", item);
  await refreshState();
  el("supplierForm").reset();
  renderAll();
  toast("Supplier saved.");
}

function renderSuppliers() {
  const query = el("supplierSearch").value?.toLowerCase() || "";
  const rows = state.suppliers.filter((item) => `${item.name} ${item.mobile} ${item.gst}`.toLowerCase().includes(query));
  el("supplierTable").innerHTML = rows.map((item) => {
    const purchases = state.purchases.filter((purchase) => purchase.supplierId === item.id);
    return `<tr><td>${item.name}</td><td>${item.mobile}</td><td>${item.gst}</td><td>${money(sum(purchases, (purchase) => purchase.total))}</td><td>${money(sum(purchases, (purchase) => purchase.total))}</td><td><button class="mini-btn" onclick="editSupplier('${item.id}')">Edit</button></td></tr>`;
  }).join("") || `<tr><td colspan="6">No suppliers found.</td></tr>`;
}

window.editSupplier = function editSupplier(id) {
  const item = state.suppliers.find((supplier) => supplier.id === id);
  el("supplierId").value = item.id;
  el("supplierName").value = item.name;
  el("supplierMobile").value = item.mobile;
  el("supplierAddress").value = item.address;
  el("supplierGst").value = item.gst;
};

async function saveExpense(event) {
  event.preventDefault();
  await put("expenses", {
    id: uid("exp"),
    date: el("expenseDate").value,
    category: el("expenseCategory").value,
    amount: Number(el("expenseAmount").value),
    notes: el("expenseNotes").value
  });
  await rebuildLedger();
  await refreshState();
  el("expenseForm").reset();
  el("expenseDate").value = today();
  renderAll();
  toast("Expense saved.");
}

function renderExpenses() {
  el("expenseTotalLabel").textContent = `Total: ${money(sum(state.expenses, (item) => item.amount))}`;
  el("expenseTable").innerHTML = state.expenses.slice().reverse().map((item) => `<tr><td>${item.date}</td><td>${item.category}</td><td>${item.notes || "-"}</td><td>${money(item.amount)}</td></tr>`).join("") || `<tr><td colspan="4">No expenses yet.</td></tr>`;
}

function renderBills() {
  const query = el("billFilter").value?.toLowerCase() || "";
  const date = el("billDateFilter").value;
  const rows = state.bills.filter((bill) => {
    const customer = state.customers.find((item) => item.id === bill.customerId)?.name || "Walk-in";
    const products = bill.items.map((item) => item.name).join(" ");
    const payments = Object.entries(bill.payments).filter(([, value]) => value > 0).map(([key]) => key).join(" ");
    const text = `${bill.billNo} ${customer} ${products} ${payments}`.toLowerCase();
    return (!date || bill.date === date) && text.includes(query);
  }).slice().reverse();
  el("billHistory").innerHTML = rows.map((bill) => {
    const customer = state.customers.find((item) => item.id === bill.customerId)?.name || "Walk-in";
    const payments = Object.entries(bill.payments).filter(([, value]) => value > 0).map(([key, value]) => `${key.toUpperCase()}: ${money(value)}`).join(", ");
    return `
      <tr>
        <td>${bill.billNo}</td>
        <td>${bill.date}</td>
        <td>${customer}</td>
        <td>${payments}</td>
        <td>${money(bill.total)}</td>
        <td class="row-actions">
          <button class="mini-btn" onclick="showInvoice('${bill.id}')">View</button>
          <button class="mini-btn" onclick="editBill('${bill.id}')">Edit</button>
          <button class="mini-btn danger" onclick="deleteBill('${bill.id}')">Delete</button>
        </td>
      </tr>`;
  }).join("") || `<tr><td colspan="6">No bills found.</td></tr>`;
}

window.showInvoice = function showInvoice(id) {
  const bill = state.bills.find((item) => item.id === id) || state.selectedInvoice;
  if (!bill) return;
  state.selectedInvoice = bill;
  const customer = state.customers.find((item) => item.id === bill.customerId);
  el("invoiceContent").innerHTML = invoiceHtml(bill, customer);
  el("invoiceDialog").showModal();
};

function invoiceHtml(bill, customer) {
  const rows = bill.items.map((item) => `<tr><td>${item.name}<br><small>${item.size}/${item.color}</small></td><td>${item.qty}</td><td>${money(item.rate)}</td><td>${money(item.discount)}</td><td>${item.gst}%</td><td>${money(item.total)}</td></tr>`).join("");
  const payments = Object.entries(bill.payments).filter(([, value]) => value > 0).map(([key, value]) => `<p>${key.toUpperCase()}: ${money(value)}</p>`).join("");
  return `
    <div class="invoice-top">
      <div>
        <h2>Happy ERP Store</h2>
        <p>Main Bazaar, Your City</p>
        <p>Mobile: 9876543210 | GST: 27ABCDE1234F1Z5</p>
      </div>
      <div>
        <p><strong>${bill.billNo}</strong></p>
        <p>${bill.date} ${bill.time}</p>
      </div>
    </div>
    <p><strong>Customer:</strong> ${customer ? `${customer.name} (${customer.mobile})` : "Walk-in Customer"}</p>
    <table><thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Disc</th><th>GST</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="invoice-top">
      <div><div class="qr-box">UPI QR<br>PAY</div><p>Scan and pay</p></div>
      <div>
        <p>Subtotal: ${money(bill.subtotal)}</p>
        <p>Discount: ${money(bill.discount)}</p>
        <p>GST: ${money(bill.gst)}</p>
        <p>Extra: ${money(bill.extra)}</p>
        <h2>Total: ${money(bill.total)}</h2>
        ${payments}
      </div>
    </div>
        <p><strong>Notes:</strong> ${bill.notes || "Thank you for shopping with Happy ERP Store."}</p>
  `;
}

window.editBill = function editBill(id) {
  const bill = state.bills.find((item) => item.id === id);
  if (!bill) return;
  state.editingBillId = id;
  state.currentBill = bill.items.map((item) => ({ productId: item.productId, qty: item.qty, rate: item.rate, discount: item.discount, gst: item.gst }));
  el("billCustomer").value = bill.customerId;
  el("billNotes").value = bill.notes || "";
  el("payCash").value = bill.payments.cash || 0;
  el("payUpi").value = bill.payments.upi || 0;
  el("payBank").value = bill.payments.bank || 0;
  el("payCard").value = bill.payments.card || 0;
  el("payCreditNote").value = bill.payments.creditNote || 0;
  el("paySalesReturn").value = bill.payments.salesReturn || 0;
  el("payCredit").value = bill.payments.credit || 0;
  el("billNoLabel").textContent = `Editing: ${bill.billNo}`;
  showView("billing");
  renderBill();
};

window.deleteBill = async function deleteBill(id) {
  const bill = state.bills.find((item) => item.id === id);
  if (!bill || !confirm(`Delete ${bill.billNo}? Stock will be restored.`)) return;
  await reverseBillStock(bill);
  await remove("bills", id);
  await rebuildLedger();
  await refreshState();
  renderAll();
  toast("Bill deleted and stock restored.");
};

async function rebuildLedger() {
  await clearStore("ledger");
  for (const bill of await getAll("bills")) {
    for (const [mode, amount] of Object.entries(bill.payments)) {
      if (amount > 0) {
        const label = mode.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim().toUpperCase();
        const type = mode === "credit" ? "Receivable" : mode === "salesReturn" ? "Sales Return" : mode === "creditNote" ? "Credit Note" : "Sale";
        await put("ledger", { id: uid("led"), date: bill.date, account: `${label} Account`, type, ref: bill.billNo, amount });
      }
    }
  }
  for (const purchase of await getAll("purchases")) {
    await put("ledger", { id: uid("led"), date: purchase.date, account: "Supplier Account", type: "Purchase", ref: purchase.invoice, amount: -purchase.total });
  }
  for (const expense of await getAll("expenses")) {
    await put("ledger", { id: uid("led"), date: expense.date, account: "Cash Account", type: "Expense", ref: expense.category, amount: -expense.amount });
  }
}

function renderAccounts() {
  const accountTotals = [
    ["Cash Account", getMetrics().cash - sum(state.expenses, (item) => item.amount)],
    ["UPI Account", getMetrics().upi],
    ["Bank Account", getMetrics().bank],
    ["Credit Note Account", getMetrics().creditNote],
    ["Sales Return Account", getMetrics().salesReturn],
    ["Supplier Account", -sum(state.purchases, (item) => item.total)],
    ["Customer Account", getMetrics().credit]
  ];
  el("accountCards").innerHTML = accountTotals.map(([label, value]) => `<article class="summary-card"><span>${label}</span><strong>${money(value)}</strong><small>Auto ledger</small></article>`).join("");
  el("ledgerTable").innerHTML = state.ledger.slice().reverse().map((item) => `<tr><td>${item.date}</td><td>${item.account}</td><td>${item.type}</td><td>${item.ref}</td><td>${money(item.amount)}</td></tr>`).join("") || `<tr><td colspan="5">No ledger entries yet.</td></tr>`;
}

function renderReports() {
  const date = el("reportDate").value || today();
  const month = el("reportMonth").value || monthKey();
  const dailyBills = state.bills.filter((bill) => bill.date === date);
  const monthlyBills = state.bills.filter((bill) => bill.date.startsWith(month));
  const monthlyPurchases = state.purchases.filter((item) => item.date.startsWith(month));
  const metrics = getMetrics();
  const daily = [
    ["Total Sale", sum(dailyBills, (bill) => bill.total)],
    ["Cash Sale", sum(dailyBills, (bill) => bill.payments.cash)],
    ["UPI Sale", sum(dailyBills, (bill) => bill.payments.upi)],
    ["Bank Sale", sum(dailyBills, (bill) => bill.payments.bank)],
    ["Credit Sale", sum(dailyBills, (bill) => bill.payments.credit)],
    ["Profit", sum(dailyBills, (bill) => bill.profit) - sum(state.expenses.filter((item) => item.date === date), (item) => item.amount)]
  ];
  const monthly = [
    ["Sale", sum(monthlyBills, (bill) => bill.total)],
    ["Purchase", sum(monthlyPurchases, (item) => item.total)],
    ["Expenses", sum(state.expenses.filter((item) => item.date.startsWith(month)), (item) => item.amount)],
    ["Profit", sum(monthlyBills, (bill) => bill.profit) - sum(state.expenses.filter((item) => item.date.startsWith(month)), (item) => item.amount)]
  ];
  el("dailyReport").innerHTML = reportItems(daily);
  el("monthlyReport").innerHTML = reportItems(monthly);
  el("salesReportList").innerHTML = reportItems([
    ["Total Invoices", monthlyBills.length],
    ["Gross Sales", sum(monthlyBills, (bill) => bill.total)],
    ["Cash Sales", sum(monthlyBills, (bill) => bill.payments.cash)],
    ["Credit Notes Used", sum(monthlyBills, (bill) => bill.payments.creditNote)],
    ["Sales Returns Adjusted", sum(monthlyBills, (bill) => bill.payments.salesReturn)],
    ["Credit Outstanding", sum(monthlyBills, (bill) => bill.payments.credit)]
  ]);
  el("purchaseReportList").innerHTML = reportItems([
    ["Purchase Bills", monthlyPurchases.length],
    ["Purchase Value", sum(monthlyPurchases, (item) => item.total)],
    ["Input GST", sum(monthlyPurchases, (purchase) => purchase.total - (purchase.total / (1 + Number(purchase.gst || 0) / 100)))],
    ["Supplier Pending", sum(state.purchases, (item) => item.total)]
  ]);
  el("inventoryReportList").innerHTML = reportItems([
    ["Total Products", state.products.length],
    ["Current Stock Qty", sum(state.products, (item) => item.stock)],
    ["Low Stock Items", state.products.filter((item) => item.stock > 0 && item.stock <= lowStockLimit).length],
    ["Out Of Stock", state.products.filter((item) => item.stock <= 0).length],
    ["Stock Value", sum(state.products, (item) => item.stock * item.purchaseRate)]
  ]);
  el("accountsReportList").innerHTML = reportItems([
    ["Cash Account", metrics.cash - sum(state.expenses, (item) => item.amount)],
    ["UPI Account", metrics.upi],
    ["Bank Account", metrics.bank],
    ["Credit Note Account", metrics.creditNote],
    ["Sales Return Account", metrics.salesReturn],
    ["Customer Receivable", metrics.credit]
  ]);
  el("gstReportList").innerHTML = reportItems([
    ["Output GST On Sales", metrics.outputGst],
    ["Input GST On Purchase", metrics.inputGst],
    ["GST Payable", Math.max(0, metrics.gstPayable)],
    ["GST Credit", Math.max(0, -metrics.gstPayable)],
    ["Return Period", month]
  ]);
}

function reportItems(items) {
  return items.map(([label, value]) => {
    const isCount = /Invoices|Bills|Products|Items|Qty|Out Of Stock|Low Stock/.test(label);
    const display = typeof value === "number" && !isCount ? money(value) : value;
    return `<div class="report-item"><span>${label}</span><strong>${display}</strong></div>`;
  }).join("");
}

function renderUsers() {
  const permissions = ["Billing", "Edit Bill", "Delete Bill", "Reports", "Stock"];
  el("userTable").innerHTML = state.users.map((user) => `<tr><td>${user.name}</td><td>${user.role}</td>${permissions.map((permission) => `<td>${user.permissions.includes(permission) ? "Yes" : "No"}</td>`).join("")}</tr>`).join("");
}

function exportReportCsv() {
  const rows = [
    { report: "Daily", metric: "Total Sale", amount: sum(state.bills.filter((bill) => bill.date === el("reportDate").value), (bill) => bill.total) },
    { report: "Monthly", metric: "Sale", amount: sum(state.bills.filter((bill) => bill.date.startsWith(el("reportMonth").value)), (bill) => bill.total) }
  ];
  downloadCsv("reports.csv", rows);
}

function downloadCsv(filename, rows) {
  if (!rows.length) return toast("No data to export.");
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
  downloadFile(filename, csv, "text/csv");
}

async function exportData() {
  const data = {};
  for (const name of STORE_NAMES.filter((item) => item !== "settings")) data[name] = await getAll(name);
  downloadFile(`kapda-erp-backup-${today()}.json`, JSON.stringify(data, null, 2), "application/json");
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const data = JSON.parse(await file.text());
  for (const name of STORE_NAMES.filter((item) => item !== "settings")) {
    await clearStore(name);
    for (const item of data[name] || []) await put(name, item);
  }
  await refreshState();
  renderAll();
  toast("Backup imported.");
}

function downloadInvoice() {
  if (!state.selectedInvoice) return;
  downloadFile(`${state.selectedInvoice.billNo}.html`, el("invoiceContent").innerHTML, "text/html");
}

function sendInvoiceWhatsapp() {
  if (!state.selectedInvoice) return;
  const text = encodeURIComponent(`Invoice ${state.selectedInvoice.billNo} total ${money(state.selectedInvoice.total)}. Thank you for shopping at Happy ERP Store.`);
  window.open(`https://wa.me/?text=${text}`, "_blank");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function toast(message) {
  el("toast").textContent = message;
  el("toast").classList.add("show");
  setTimeout(() => el("toast").classList.remove("show"), 2400);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  if (localStorage.getItem("kapda-theme") === "dark") document.body.classList.add("dark");
  if (localStorage.getItem("happy-sidebar") === "collapsed") document.querySelector(".app-shell").classList.add("sidebar-collapsed");
}
