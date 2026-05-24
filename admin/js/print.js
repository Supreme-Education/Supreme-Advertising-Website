(function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const autoPrint = params.get("print") === "1";

  const root = document.getElementById("print-root");

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatMoney(n) {
    return `LKR ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-LK", { year: "numeric", month: "long", day: "numeric" });
  }

  function renderCompanyPhones(company) {
    const numbers = [company.phone, company.phoneSecondary].filter(Boolean);
    return numbers.map((num) => `<p>Tel: ${escapeHtml(num)}</p>`).join("");
  }

  async function load() {
    if (!id) {
      root.innerHTML = "<p>Missing document ID.</p>";
      return;
    }

    try {
      const session = await fetch("/api/session", { credentials: "same-origin" });
      const { authenticated } = await session.json();
      if (!authenticated) {
        window.location.href = "/admin";
        return;
      }

      const res = await fetch(`/api/documents/${id}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Not found");
      const doc = await res.json();
      const companyRes = await fetch("/api/company", { credentials: "same-origin" });
      const company = await companyRes.json();

      const isInvoice = doc.type === "invoice";
      const title = isInvoice ? "Invoice" : "Quotation";

      document.title = `${doc.doc_number} | ${title} | ${company.name}`;

      root.innerHTML = `
        <article class="print-page">
          <header class="print-header">
            <div class="print-company">
              <strong>${escapeHtml(company.name)}</strong>
              <p>${escapeHtml(company.address)}</p>
              ${renderCompanyPhones(company)}
              <p>${escapeHtml(company.email)}</p>
            </div>
            <div class="print-meta">
              <h1>${title}</h1>
              <table>
                <tr><td>Number</td><td><strong>${escapeHtml(doc.doc_number)}</strong></td></tr>
                <tr><td>Date</td><td>${formatDate(doc.issue_date)}</td></tr>
              </table>
            </div>
          </header>

          <div class="print-parties">
            <div>
              <h3>Bill to</h3>
              <p><strong>${escapeHtml(doc.client_name)}</strong></p>
              ${doc.client_company ? `<p>${escapeHtml(doc.client_company)}</p>` : ""}
              ${doc.client_address ? `<p>${escapeHtml(doc.client_address).replace(/\n/g, "<br>")}</p>` : ""}
            </div>
          </div>

          ${
            !isInvoice && doc.general_line
              ? `<p class="print-general-line"><strong>General:</strong> ${escapeHtml(doc.general_line)}</p>`
              : ""
          }

          <table class="print-items">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th class="num">Qty</th>
                <th class="num">Unit price</th>
                <th class="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${doc.line_items
                .map(
                  (row, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${escapeHtml(row.description)}</td>
                  <td class="num">${row.qty}</td>
                  <td class="num">${formatMoney(row.unit_price)}</td>
                  <td class="num">${formatMoney(row.amount ?? row.qty * row.unit_price)}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>

          <div class="print-summary">
            <table>
              <tr><td>Subtotal</td><td>${formatMoney(doc.subtotal)}</td></tr>
              <tr><td>Discount</td><td>${formatMoney(doc.discount_amount || 0)}</td></tr>
              ${doc.tax_rate > 0 ? `<tr><td>Tax (${doc.tax_rate}%)</td><td>${formatMoney(doc.tax_amount)}</td></tr>` : ""}
              <tr><td>Advance</td><td>${formatMoney(doc.advance_amount || 0)}</td></tr>
              <tr class="grand-total"><td>Total</td><td>${formatMoney(doc.total)}</td></tr>
            </table>
          </div>

          ${doc.notes ? `<div class="print-notes"><h3>Notes</h3><p>${escapeHtml(doc.notes).replace(/\n/g, "<br>")}</p></div>` : ""}

          <footer class="print-footer">
            ${isInvoice ? `Please make payment to ${escapeHtml(company.name)} as per agreed terms.` : "We look forward to working with you. This quotation is subject to our standard terms."}
          </footer>
        </article>
      `;

      if (autoPrint) {
        requestAnimationFrame(() => window.print());
      }
    } catch {
      root.innerHTML = "<p>Could not load document. <a href='/admin'>Return to admin</a></p>";
    }
  }

  document.getElementById("btn-print").addEventListener("click", () => window.print());
  document.getElementById("btn-back").addEventListener("click", () => {
    window.location.href = "/admin";
  });

  load();
})();
