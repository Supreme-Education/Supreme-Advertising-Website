(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const loginView = $("#login-view");
  const appView = $("#app-view");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");

  let currentListType = "invoice";
  let editorDocId = null;
  let customersCache = [];
  let companyDefaults = null;

  const statusOptions = {
    invoice: ["draft", "sent", "paid"],
    quotation: ["draft", "sent", "accepted", "rejected"],
  };

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      credentials: "same-origin",
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && path !== "/api/login") {
        throw new Error("Session expired. Please sign in again.");
      }
      if (res.status === 404) {
        throw new Error(
          data.error ||
            "Admin API not found. Redeploy with Netlify Functions and set ADMIN_PASSWORD in site env vars."
        );
      }
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  function formatMoney(n) {
    return `LKR ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatListCount(count, singular, plural) {
    const n = Number(count) || 0;
    const label = n === 1 ? singular : plural || `${singular}s`;
    return `${n.toLocaleString("en-LK")} ${label}`;
  }

  function setListCount(el, count, singular, plural, searchQuery = "") {
    if (!el) return;
    let text = formatListCount(count, singular, plural);
    if (searchQuery) text += " (filtered)";
    el.textContent = text;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function showLogin() {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
  }

  function showApp() {
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
  }

  async function checkSession() {
    try {
      const { authenticated } = await api("/api/session");
      if (authenticated) {
        showApp();
        showView("dashboard");
        await refreshDashboard();
      } else {
        showLogin();
      }
    } catch {
      showLogin();
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ password: $("#password").value.trim() }),
      });
      $("#password").value = "";
      showApp();
      showView("dashboard");
      await refreshDashboard();
    } catch (err) {
      const msg = String(err.message || "");
      if (msg.toLowerCase().includes("invalid password")) {
        loginError.textContent = "Incorrect password. Please try again.";
      } else if (msg.includes("404") || msg.includes("Failed to fetch") || msg.includes("not found")) {
        loginError.textContent =
          "Cannot reach the admin API. Redeploy the site and set ADMIN_PASSWORD + SESSION_SECRET in Netlify environment variables.";
      } else {
        loginError.textContent = msg || "Sign-in failed. Please try again.";
      }
      loginError.classList.remove("hidden");
    }
  });

  $("#logout-btn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    showLogin();
  });

  function showView(name) {
    $$(".admin-view").forEach((el) => el.classList.add("hidden"));
    $$("#admin-nav button").forEach((btn) => btn.classList.remove("active"));

    if (name === "dashboard") {
      $("#view-dashboard").classList.remove("hidden");
      $('[data-view="dashboard"]').classList.add("active");
    } else if (name === "invoices" || name === "quotations") {
      currentListType = name === "invoices" ? "invoice" : "quotation";
      $("#view-list").classList.remove("hidden");
      $(`[data-view="${name}"]`).classList.add("active");
      $("#list-title").textContent = name === "invoices" ? "Invoices" : "Quotations";
      $("#list-new-btn").textContent =
        name === "invoices" ? "+ New invoice" : "+ New quotation";
      loadList();
    } else if (name === "customers") {
      $("#view-customers").classList.remove("hidden");
      $('[data-view="customers"]').classList.add("active");
      hideCustomerForm();
      loadCustomersList();
    } else if (name === "editor") {
      $("#view-editor").classList.remove("hidden");
      $("#nav-editor").classList.remove("hidden");
      $("#nav-editor").classList.add("active");
    }
  }

  $$("#admin-nav button[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view === "dashboard") {
        showView("dashboard");
        refreshDashboard();
      } else if (view === "invoices" || view === "quotations") {
        showView(view);
      } else if (view === "customers") {
        showView("customers");
      }
    });
  });

  $$("[data-new]").forEach((btn) => {
    btn.addEventListener("click", () => openEditor(null, btn.dataset.new).catch(showEditorError));
  });

  $("#list-new-btn").addEventListener("click", () =>
    openEditor(null, currentListType).catch(showEditorError)
  );

  function showEditorError(err) {
    alert(err?.message || "Could not open the editor. Please try again.");
  }

  async function refreshDashboard() {
    const stats = await api("/api/stats");
    $("#stats-grid").innerHTML = `
      <div class="stat-card"><strong>${stats.invoices.count}</strong><span>Invoices</span></div>
      <div class="stat-card"><strong>${formatMoney(stats.invoices.total)}</strong><span>Invoice value (total)</span></div>
      <div class="stat-card"><strong>${stats.quotations.count}</strong><span>Quotations</span></div>
    `;

    const docs = await api("/api/documents");
    const recent = docs.slice(0, 8);
    $("#dashboard-recent").innerHTML = recent.length
      ? renderTable(recent)
      : '<p class="empty-state">No documents yet. Create an invoice or quotation.</p>';
    bindTableActions($("#dashboard-recent"));
  }

  async function loadList() {
    const search = $("#list-search").value.trim();
    const q = new URLSearchParams({ type: currentListType });
    if (search) q.set("search", search);
    const docs = await api(`/api/documents?${q}`);
    $("#list-table-wrap").innerHTML = docs.length
      ? renderTable(docs)
      : `<p class="empty-state">No ${currentListType}s found.</p>`;
    bindTableActions($("#list-table-wrap"));
    const docLabel = currentListType === "invoice" ? "invoice" : "quotation";
    setListCount(
      $("#list-count"),
      docs.length,
      docLabel,
      `${docLabel}s`,
      search
    );
  }

  $("#list-search").addEventListener("input", () => {
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(loadList, 300);
  });

  async function getQuotationGeneralDefault() {
    if (!companyDefaults) {
      try {
        companyDefaults = await api("/api/company");
      } catch {
        companyDefaults = {
          quotationGeneralLine:
            "We are pleased to submit our quotation for the following work as per your requirement:",
        };
      }
    }
    return companyDefaults.quotationGeneralLine || "";
  }

  async function fetchCustomers(search = "") {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    customersCache = await api(`/api/customers${q}`);
    return customersCache;
  }

  function hideCustomerForm() {
    $("#customer-form-panel").classList.add("hidden");
    $("#customer-form").reset();
    $("#customer-id").value = "";
  }

  function showCustomerForm(customer = null) {
    $("#customer-form-panel").classList.remove("hidden");
    $("#customer-form-title").textContent = customer ? "Edit customer" : "Add customer";
    $("#customer-id").value = customer?.id || "";
    $("#customer-name").value = customer?.name || "";
    $("#customer-company").value = customer?.company || "";
    $("#customer-email").value = customer?.email || "";
    $("#customer-phone").value = customer?.phone || "";
    $("#customer-address").value = customer?.address || "";
    $("#customer-name").focus();
  }

  async function loadCustomersList() {
    const search = $("#customers-search").value.trim();
    const customers = await fetchCustomers(search);
    $("#customers-table-wrap").innerHTML = customers.length
      ? renderCustomersTable(customers)
      : '<p class="empty-state">No customers yet. Add your first customer above.</p>';
    bindCustomerActions($("#customers-table-wrap"));
    setListCount($("#customers-list-count"), customers.length, "customer", "customers", search);
  }

  function renderCustomersTable(customers) {
    return `
      <table class="doc-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Company</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Address</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${customers
            .map(
              (c) => `
            <tr data-id="${c.id}">
              <td><strong>${escapeHtml(c.name)}</strong></td>
              <td>${escapeHtml(c.company || "—")}</td>
              <td>${escapeHtml(c.email || "—")}</td>
              <td>${escapeHtml(c.phone || "—")}</td>
              <td>${escapeHtml(c.address || "—")}</td>
              <td>
                <div class="btn-group">
                  <button type="button" class="btn btn-ghost btn-sm" data-customer-action="edit">Edit</button>
                  <button type="button" class="btn btn-danger btn-sm" data-customer-action="delete">Delete</button>
                </div>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function bindCustomerActions(root) {
    root.querySelectorAll("[data-customer-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("tr");
        const id = Number(row.dataset.id);
        const action = btn.dataset.customerAction;
        if (action === "edit") {
          const customer = await api(`/api/customers/${id}`);
          showCustomerForm(customer);
        } else if (action === "delete") {
          if (!confirm("Delete this customer permanently?")) return;
          await api(`/api/customers/${id}`, { method: "DELETE" });
          hideCustomerForm();
          loadCustomersList();
        }
      });
    });
  }

  $("#customer-email").addEventListener("blur", async () => {
    const email = $("#customer-email").value.trim();
    if (!email || $("#customer-company").value.trim()) return;
    try {
      const { company } = await api(`/api/company-from-email?email=${encodeURIComponent(email)}`);
      if (company) $("#customer-company").value = company;
    } catch {
      /* ignore */
    }
  });

  $("#customer-new-btn").addEventListener("click", () => showCustomerForm());

  $("#customer-form-cancel").addEventListener("click", hideCustomerForm);

  $("#customer-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: $("#customer-name").value.trim(),
      company: $("#customer-company").value.trim(),
      email: $("#customer-email").value.trim(),
      phone: $("#customer-phone").value.trim(),
      address: $("#customer-address").value.trim(),
    };
    if (!payload.name) {
      alert("Please enter a customer name.");
      return;
    }
    try {
      const id = $("#customer-id").value;
      if (id) {
        await api(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/customers", { method: "POST", body: JSON.stringify(payload) });
      }
      hideCustomerForm();
      await loadCustomersList();
    } catch (err) {
      alert(err.message);
    }
  });

  $("#customers-search").addEventListener("input", () => {
    clearTimeout(window._customersSearchTimer);
    window._customersSearchTimer = setTimeout(loadCustomersList, 300);
  });

  async function populateCustomerSelect(selectedId = "") {
    await fetchCustomers();
    const select = $("#customer-select");
    select.innerHTML =
      '<option value="">— Select a customer to fill details —</option>' +
      customersCache
        .map(
          (c) =>
            `<option value="${c.id}"${String(c.id) === String(selectedId) ? " selected" : ""}>${escapeHtml(c.name)}${c.company ? ` — ${escapeHtml(c.company)}` : ""}</option>`
        )
        .join("");
  }

  function applyCustomerToEditor(customerId) {
    const customer = customersCache.find((c) => String(c.id) === String(customerId));
    if (!customer) return;
    const company = (customer.company || "").trim();
    $("#client-name").value = customer.name || "";
    const addr = (customer.address || "").trim();
    $("#client-address").value =
      company && !addr.toLowerCase().startsWith(company.toLowerCase())
        ? `${company}\n${addr}`.trim()
        : addr;
    $("#client-phone").value = customer.phone || "";
    $("#client-email").value = customer.email || "";
  }

  $("#customer-select").addEventListener("change", () => {
    const id = $("#customer-select").value;
    if (id) applyCustomerToEditor(id);
  });

  function renderTable(docs) {
    return `
      <table class="doc-table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Client</th>
            <th>Date</th>
            <th>Total</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${docs
            .map(
              (d) => `
            <tr data-id="${d.id}">
              <td><strong>${escapeHtml(d.doc_number)}</strong></td>
              <td>${escapeHtml(d.client_name)}</td>
              <td>${escapeHtml(d.issue_date)}</td>
              <td>${formatMoney(d.total)}</td>
              <td><span class="badge badge-${d.type}">${d.type}</span> <span class="badge badge-${d.status}">${d.status}</span></td>
              <td>
                <div class="btn-group">
                  <button type="button" class="btn btn-ghost btn-sm" data-action="view">View</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-action="edit">Edit</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-action="print">Print</button>
                  <button type="button" class="btn btn-danger btn-sm" data-action="delete">Delete</button>
                </div>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function bindTableActions(root) {
    root.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("tr");
        const id = Number(row.dataset.id);
        const action = btn.dataset.action;
        if (action === "view") {
          window.open(`/admin/print.html?id=${id}`, "_blank");
        } else if (action === "edit") {
          const doc = await api(`/api/documents/${id}`);
          openEditor(doc).catch(showEditorError);
        } else if (action === "print") {
          window.open(`/admin/print.html?id=${id}&print=1`, "_blank");
        } else if (action === "delete") {
          if (!confirm("Delete this document permanently?")) return;
          await api(`/api/documents/${id}`, { method: "DELETE" });
          if ($("#view-list").classList.contains("hidden") === false) loadList();
          else refreshDashboard();
        }
      });
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fallbackDocNumber(docType) {
    const prefix = docType === "invoice" ? "INV" : "QUO";
    const year = new Date().getFullYear();
    return `${prefix}-${year}-001`;
  }

  async function openEditor(doc, type) {
    editorDocId = doc?.id || null;
    const docType = doc?.type || type || "invoice";
    $("#doc-type").value = docType;
    $("#editor-title").textContent = doc
      ? `Edit ${docType === "invoice" ? "invoice" : "quotation"}`
      : `New ${docType === "invoice" ? "invoice" : "quotation"}`;

    $("#due-date-field").classList.toggle("hidden", docType === "quotation");
    $("#quotation-general-section").classList.toggle("hidden", docType !== "quotation");

    const statuses = statusOptions[docType];
    $("#status").innerHTML = statuses
      .map((s) => `<option value="${s}">${s}</option>`)
      .join("");

    showView("editor");

    if (doc) {
      $("#doc-id").value = doc.id;
      $("#doc-number").value = doc.doc_number;
      $("#issue-date").value = doc.issue_date;
      $("#due-date").value = doc.due_date || "";
      $("#client-name").value = doc.client_name;
      $("#client-address").value = doc.client_address || "";
      $("#client-phone").value = doc.client_phone || "";
      $("#client-email").value = doc.client_email || "";
      $("#tax-rate").value = doc.tax_rate;
      $("#discount-amount").value = doc.discount_amount ?? 0;
      $("#advance-amount").value = doc.advance_amount ?? 0;
      $("#notes").value = doc.notes || "";
      $("#general-line").value = doc.general_line || "";
      $("#status").value = doc.status;
      renderLineItems(doc.line_items);
    } else {
      $("#doc-id").value = "";
      let doc_number = fallbackDocNumber(docType);
      try {
        ({ doc_number } = await api(`/api/next-number?type=${docType}`));
      } catch (err) {
        console.warn("next-number API failed, using fallback:", err);
      }
      $("#doc-number").value = doc_number;
      $("#issue-date").value = todayISO();
      $("#due-date").value = "";
      $("#client-name").value = "";
      $("#client-address").value = "";
      $("#client-phone").value = "";
      $("#client-email").value = "";
      $("#tax-rate").value = "0";
      $("#discount-amount").value = "0";
      $("#advance-amount").value = "0";
      $("#general-line").value =
        docType === "quotation" ? await getQuotationGeneralDefault() : "";
      $("#notes").value =
        docType === "quotation"
          ? "This quotation is valid for 30 days from the issue date."
          : "Payment due within 14 days. Thank you for your business.";
      $("#status").value = "draft";
      renderLineItems([{ description: "", qty: 1, unit_price: 0 }]);
    }

    try {
      await populateCustomerSelect();
    } catch (err) {
      console.warn("customers list failed:", err);
      $("#customer-select").innerHTML =
        '<option value="">— Select a customer to fill details —</option>';
    }
    $("#customer-select").value = "";
    updateTotalsPreview();
  }

  function renderLineItems(items) {
    const body = $("#line-items-body");
    body.innerHTML = "";
    (items.length ? items : [{ description: "", qty: 1, unit_price: 0 }]).forEach((row, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-desc"><input type="text" data-field="description" value="${escapeAttr(row.description)}" placeholder="Service or product" /></td>
        <td class="col-num"><input type="number" data-field="qty" min="0" step="any" value="${row.qty ?? 1}" /></td>
        <td class="col-num"><input type="number" data-field="unit_price" min="0" step="0.01" value="${row.unit_price ?? 0}" /></td>
        <td class="col-num line-amount">${formatMoney((row.qty || 0) * (row.unit_price || 0))}</td>
        <td><button type="button" class="btn btn-ghost btn-sm" data-remove-line ${items.length > 1 ? "" : "disabled"}>×</button></td>
      `;
      body.appendChild(tr);
    });
    bindLineItemEvents();
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function getLineItemsFromForm() {
    return $$("#line-items-body tr").map((tr) => ({
      description: $('[data-field="description"]', tr).value.trim(),
      qty: Number($('[data-field="qty"]', tr).value) || 0,
      unit_price: Number($('[data-field="unit_price"]', tr).value) || 0,
    }));
  }

  function bindLineItemEvents() {
    $$("#line-items-body input").forEach((input) => {
      input.addEventListener("input", () => {
        $$("#line-items-body tr").forEach((tr) => {
          const qty = Number($('[data-field="qty"]', tr).value) || 0;
          const price = Number($('[data-field="unit_price"]', tr).value) || 0;
          $(".line-amount", tr).textContent = formatMoney(qty * price);
        });
        updateTotalsPreview();
      });
    });
    $$("[data-remove-line]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if ($$("#line-items-body tr").length <= 1) return;
        btn.closest("tr").remove();
        updateTotalsPreview();
      });
    });
  }

  function computeTotals(subtotal, discountAmount, advanceAmount, taxRate) {
    const discount = Math.max(0, Number(discountAmount) || 0);
    const advance = Math.max(0, Number(advanceAmount) || 0);
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * ((Number(taxRate) || 0) / 100) * 100) / 100;
    const total = Math.round(Math.max(0, taxable + tax - advance) * 100) / 100;
    return { subtotal, discount, advance, taxable, tax, total };
  }

  function updateTotalsPreview() {
    const items = getLineItemsFromForm();
    const subtotal = items.reduce((s, r) => s + r.qty * r.unit_price, 0);
    const totals = computeTotals(
      subtotal,
      $("#discount-amount").value,
      $("#advance-amount").value,
      $("#tax-rate").value
    );
    $("#preview-subtotal").textContent = formatMoney(totals.subtotal);
    $("#preview-tax").textContent = formatMoney(totals.tax);
    $("#preview-total").textContent = formatMoney(totals.total);
  }

  $("#tax-rate").addEventListener("input", updateTotalsPreview);
  $("#discount-amount").addEventListener("input", updateTotalsPreview);
  $("#advance-amount").addEventListener("input", updateTotalsPreview);

  $("#add-line-btn").addEventListener("click", () => {
    const items = getLineItemsFromForm();
    items.push({ description: "", qty: 1, unit_price: 0 });
    renderLineItems(items);
    updateTotalsPreview();
  });

  $("#editor-back").addEventListener("click", () => {
    const type = $("#doc-type").value;
    showView(type === "invoice" ? "invoices" : "quotations");
  });

  $("#editor-print").addEventListener("click", () => {
    if (editorDocId) window.open(`/admin/print.html?id=${editorDocId}`, "_blank");
  });

  $("#editor-form").addEventListener("submit", (e) => e.preventDefault());

  $("#editor-save").addEventListener("click", async () => {
    const payload = collectFormPayload();
    if (!payload.client_name) {
      alert("Please enter a client name.");
      return;
    }
    if (!payload.line_items.some((r) => r.description && r.qty > 0)) {
      alert("Add at least one line item with a description and quantity.");
      return;
    }

    try {
      let saved;
      if (editorDocId) {
        saved = await api(`/api/documents/${editorDocId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        saved = await api("/api/documents", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        editorDocId = saved.id;
        $("#doc-id").value = saved.id;
      }
      alert("Saved successfully.");
      openEditor(saved);
    } catch (err) {
      alert(err.message);
    }
  });

  function collectFormPayload() {
    return {
      type: $("#doc-type").value,
      issue_date: $("#issue-date").value,
      due_date: $("#due-date").value || null,
      client_name: $("#client-name").value.trim(),
      client_address: $("#client-address").value.trim(),
      client_phone: $("#client-phone").value.trim(),
      client_email: $("#client-email").value.trim(),
      line_items: getLineItemsFromForm(),
      tax_rate: Number($("#tax-rate").value) || 0,
      discount_amount: Number($("#discount-amount").value) || 0,
      advance_amount: Number($("#advance-amount").value) || 0,
      general_line:
        $("#doc-type").value === "quotation" ? $("#general-line").value.trim() : "",
      notes: $("#notes").value.trim(),
      status: $("#status").value,
    };
  }

  checkSession();
})();
