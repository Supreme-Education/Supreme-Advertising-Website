(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const loginView = $("#login-view");
  const appView = $("#app-view");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");

  let currentListType = "invoice";
  let editorDocId = null;

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
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function formatMoney(n) {
    return `LKR ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
        body: JSON.stringify({ password: $("#password").value }),
      });
      $("#password").value = "";
      showApp();
      showView("dashboard");
      await refreshDashboard();
    } catch {
      loginError.textContent = "Incorrect password. Please try again.";
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
      }
    });
  });

  $$("[data-new]").forEach((btn) => {
    btn.addEventListener("click", () => openEditor(null, btn.dataset.new));
  });

  $("#list-new-btn").addEventListener("click", () => openEditor(null, currentListType));

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
  }

  $("#list-search").addEventListener("input", () => {
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(loadList, 300);
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
        if (action === "edit") {
          const doc = await api(`/api/documents/${id}`);
          openEditor(doc);
        } else if (action === "print") {
          window.open(`/admin/print.html?id=${id}`, "_blank");
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

  async function openEditor(doc, type) {
    editorDocId = doc?.id || null;
    const docType = doc?.type || type || "invoice";
    $("#doc-type").value = docType;
    $("#editor-title").textContent = doc
      ? `Edit ${docType === "invoice" ? "invoice" : "quotation"}`
      : `New ${docType === "invoice" ? "invoice" : "quotation"}`;

    $("#due-date-field").classList.toggle("hidden", docType === "quotation");

    const statuses = statusOptions[docType];
    $("#status").innerHTML = statuses
      .map((s) => `<option value="${s}">${s}</option>`)
      .join("");

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
      $("#notes").value = doc.notes || "";
      $("#status").value = doc.status;
      renderLineItems(doc.line_items);
    } else {
      $("#doc-id").value = "";
      const { doc_number } = await api(`/api/next-number?type=${docType}`);
      $("#doc-number").value = doc_number;
      $("#issue-date").value = todayISO();
      $("#due-date").value = "";
      $("#client-name").value = "";
      $("#client-address").value = "";
      $("#client-phone").value = "";
      $("#client-email").value = "";
      $("#tax-rate").value = "0";
      $("#notes").value =
        docType === "quotation"
          ? "This quotation is valid for 30 days from the issue date."
          : "Payment due within 14 days. Thank you for your business.";
      $("#status").value = "draft";
      renderLineItems([{ description: "", qty: 1, unit_price: 0 }]);
    }

    updateTotalsPreview();
    showView("editor");
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

  function updateTotalsPreview() {
    const items = getLineItemsFromForm();
    const subtotal = items.reduce((s, r) => s + r.qty * r.unit_price, 0);
    const taxRate = Number($("#tax-rate").value) || 0;
    const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    $("#preview-subtotal").textContent = formatMoney(subtotal);
    $("#preview-tax").textContent = formatMoney(tax);
    $("#preview-total").textContent = formatMoney(total);
  }

  $("#tax-rate").addEventListener("input", updateTotalsPreview);

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
      notes: $("#notes").value.trim(),
      status: $("#status").value,
    };
  }

  checkSession();
})();
