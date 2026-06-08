const products = [
  {
    id: 1,
    name: "Slim Fit Cotton Shirt",
    category: "Shirts",
    barcode: "RJSH1001",
    size: "M",
    color: "Sky Blue",
    stock: 36,
    price: 1299,
    gst: 5,
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: 2,
    name: "Formal Navy Trouser",
    category: "Trousers",
    barcode: "RJTR2044",
    size: "32",
    color: "Navy",
    stock: 12,
    price: 1799,
    gst: 12,
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: 3,
    name: "Premium Linen Kurta",
    category: "Ethnic",
    barcode: "RJKT3098",
    size: "L",
    color: "Ivory",
    stock: 7,
    price: 2199,
    gst: 5,
    image: "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: 4,
    name: "Classic Denim Jeans",
    category: "Jeans",
    barcode: "RJJN5502",
    size: "34",
    color: "Indigo",
    stock: 24,
    price: 2499,
    gst: 12,
    image: "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=500&q=80"
  }
];

const cartItems = [
  { id: 1, name: "Slim Fit Cotton Shirt", qty: 2, price: 1299, gst: 5 },
  { id: 2, name: "Formal Navy Trouser", qty: 1, price: 1799, gst: 12 }
];

let currentPage = "dashboard";
let isLoggedIn = false;
let isDark = false;
let discount = 10;

const app = document.getElementById("app");

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function render() {
  document.body.className = isDark ? "dark" : "";
  app.innerHTML = isLoggedIn ? appShell() : loginPage();
  attachEvents();
}

function loginPage() {
  return `
    <section class="login-page">
      <div class="login-visual">
        <img src="https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1400&q=80" alt="Mens wear shop">
        <div class="login-copy">
          <p class="eyebrow">Mens Wear Cloud ERP</p>
          <h1>Raj ERP</h1>
          <p>Billing, inventory, products, and shop performance in one professional workspace.</p>
        </div>
      </div>
      <div class="login-form-wrap">
        <div class="login-card">
          <div class="brand-row">
            <div class="brand-icon">R</div>
            <div>
              <h2>Raj ERP</h2>
              <p>Admin and staff login</p>
            </div>
          </div>
          <label class="field">
            <span>Email</span>
            <input type="email" value="admin@rajerp.in">
          </label>
          <label class="field">
            <span>Password</span>
            <input type="password" value="password">
          </label>
          <label class="field">
            <span>Role</span>
            <select>
              <option>Admin</option>
              <option>Staff</option>
            </select>
          </label>
          <button class="primary-btn full" id="loginBtn">Login to ERP</button>
          <p class="helper-text">Static demo screen. Backend authentication can be connected later.</p>
        </div>
      </div>
    </section>
  `;
}

function appShell() {
  return `
    <div class="app-shell">
      ${sidebar()}
      <main class="main">
        ${topbar()}
        <section class="content">${pageContent()}</section>
      </main>
    </div>
  `;
}

function sidebar() {
  const nav = [
    ["dashboard", "Dashboard", "📊"],
    ["products", "Products", "📦"],
    ["pos", "POS Billing", "▦"]
  ];

  return `
    <aside class="sidebar" id="sidebar">
      <div class="brand-row">
        <div class="brand-icon">R</div>
        <div>
          <h2>Raj ERP</h2>
          <p>Mens wear POS</p>
        </div>
      </div>
      <nav class="nav">
        ${nav.map(([id, label, icon]) => `
          <button class="nav-btn ${currentPage === id ? "active" : ""}" data-page="${id}">
            <span>${icon}</span>${label}
          </button>
        `).join("")}
      </nav>
    </aside>
  `;
}

function topbar() {
  const titles = {
    dashboard: "Dashboard",
    products: "Products",
    pos: "POS Billing"
  };

  return `
    <header class="topbar">
      <div>
        <button class="icon-btn mobile-menu" id="menuBtn">☰</button>
        <h1>${titles[currentPage]}</h1>
        <p>Raj Mens Wear, Main Branch</p>
      </div>
      <div class="top-actions">
        <button class="icon-btn" title="Alerts">🔔</button>
        <button class="icon-btn" id="themeBtn" title="Theme">${isDark ? "☀" : "☾"}</button>
        <button class="icon-btn" id="logoutBtn" title="Logout">↪</button>
      </div>
    </header>
  `;
}

function pageContent() {
  if (currentPage === "products") return productManagement();
  if (currentPage === "pos") return posBilling();
  return dashboard();
}

function dashboard() {
  const cards = [
    ["Total Sales", money(842500), "This month", "₹"],
    ["Today Sales", money(48500), "28 invoices", "↗"],
    ["Stock Items", "1,248", "Across 7 categories", "□"],
    ["Low Stock", "14", "Needs reorder", "!"]
  ];

  return `
    <div class="stats-grid">
      ${cards.map(([title, value, note, icon]) => `
        <article class="card">
          <div class="card-top">
            <div class="stat-icon">${icon}</div>
            <span class="pill">Live</span>
          </div>
          <p>${title}</p>
          <h3>${value}</h3>
          <p>${note}</p>
        </article>
      `).join("")}
    </div>
    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Profit Overview</h2>
            <p>Daily revenue and profit trend</p>
          </div>
          <select class="form-input">
            <option>Last 7 days</option>
            <option>This month</option>
          </select>
        </div>
        <div class="bars">
          ${[42, 64, 52, 78, 58, 86, 72].map((height, index) => `
            <div class="bar-wrap">
              <div class="bar" style="height:${height}%"></div>
              <span>D${index + 1}</span>
            </div>
          `).join("")}
        </div>
      </section>
      <section class="panel">
        <h2>Low Stock Alerts</h2>
        <div class="alert-list">
          ${products.filter((product) => product.stock <= 12).map((product) => `
            <div class="stock-alert">
              <div>
                <strong>${product.name}</strong>
                <p>${product.size} / ${product.color}</p>
              </div>
              <span class="count">${product.stock}</span>
            </div>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function productManagement() {
  return `
    <div class="toolbar">
      <div class="search-box">
        <span>⌕</span>
        <input class="search-input" placeholder="Search products, barcode, category">
      </div>
      <button class="primary-btn">+ Add Product</button>
    </div>
    <div class="products-layout">
      <section class="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Barcode</th>
              <th>Variant</th>
              <th>Stock</th>
              <th>Price</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${products.map((product) => `
              <tr>
                <td>
                  <div class="product-cell">
                    <img src="${product.image}" alt="${product.name}">
                    <div>
                      <strong>${product.name}</strong>
                      <p>${product.category}</p>
                    </div>
                  </div>
                </td>
                <td>${product.barcode}</td>
                <td>${product.size} / ${product.color}</td>
                <td><span class="${product.stock <= 10 ? "stock-low" : "stock-good"}">${product.stock} pcs</span></td>
                <td><strong>${money(product.price)}</strong></td>
                <td>
                  <button class="ghost-btn">Edit</button>
                  <button class="ghost-btn">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
      <aside class="panel">
        <h2>Quick Product Entry</h2>
        <div class="quick-form">
          <input class="form-input" placeholder="Product name">
          <div class="two-cols">
            <input class="form-input" placeholder="Size">
            <input class="form-input" placeholder="Color">
          </div>
          <input class="form-input" placeholder="Barcode">
          <div class="two-cols">
            <input class="form-input" placeholder="Stock">
            <input class="form-input" placeholder="Price">
          </div>
          <button class="dark-btn">Save Product</button>
        </div>
      </aside>
    </div>
  `;
}

function posBilling() {
  const subtotal = cartItems.reduce((total, item) => total + item.qty * item.price, 0);
  const gst = cartItems.reduce((total, item) => total + (item.qty * item.price * item.gst) / 100, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal + gst - discountAmount;

  return `
    <div class="pos-layout">
      <section>
        <div class="panel scan-card">
          <div class="scan-row">
            <input class="form-input" placeholder="Scan barcode or search item">
            <button class="primary-btn">Add Item</button>
          </div>
        </div>
        <div class="product-grid">
          ${products.map((product) => `
            <button class="product-tile">
              <img src="${product.image}" alt="${product.name}">
              <h3>${product.name}</h3>
              <p>${product.size} / ${product.color}</p>
              <div class="tile-foot">
                <strong>${money(product.price)}</strong>
                <span class="pill">${product.stock} pcs</span>
              </div>
            </button>
          `).join("")}
        </div>
      </section>
      <aside class="panel">
        <div class="invoice-head">
          <div>
            <h2>GST Invoice</h2>
            <p>Invoice #RJ-1028</p>
          </div>
          <button class="icon-btn">⎙</button>
        </div>
        <div class="customer-row">
          <input class="form-input" placeholder="Customer mobile number">
          <button class="green-btn">WhatsApp</button>
        </div>
        <div class="cart-list">
          ${cartItems.map((item) => `
            <div class="cart-item">
              <div>
                <strong>${item.name}</strong>
                <p>${item.qty} x ${money(item.price)} | GST ${item.gst}%</p>
              </div>
              <strong>${money(item.qty * item.price)}</strong>
            </div>
          `).join("")}
        </div>
        <div class="bill-box">
          ${billRow("Subtotal", money(subtotal))}
          ${billRow("GST", money(gst))}
          <div class="bill-row">
            <span>Discount</span>
            <span><input class="discount-input" id="discountInput" type="number" value="${discount}"> %</span>
          </div>
          ${billRow("Discount Amount", `-${money(discountAmount)}`)}
        </div>
        <div class="grand-total">
          <span>Grand Total</span>
          <span>${money(total)}</span>
        </div>
        <div class="payment-grid">
          <button class="ghost-btn">Cash</button>
          <button class="ghost-btn">UPI</button>
          <button class="ghost-btn">Card</button>
        </div>
        <button class="dark-btn full" style="margin-top:14px">Complete Billing</button>
      </aside>
    </div>
  `;
}

function billRow(label, value) {
  return `
    <div class="bill-row">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function attachEvents() {
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      isLoggedIn = true;
      render();
    });
  }

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      currentPage = button.dataset.page;
      render();
    });
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      isLoggedIn = false;
      currentPage = "dashboard";
      render();
    });
  }

  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      isDark = !isDark;
      render();
    });
  }

  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");
  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
  }

  const discountInput = document.getElementById("discountInput");
  if (discountInput) {
    discountInput.addEventListener("input", (event) => {
      discount = Number(event.target.value || 0);
      render();
    });
  }
}

render();
