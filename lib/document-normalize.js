function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseDocument(row) {
  if (!row) return null;
  return {
    ...row,
    line_items: Array.isArray(row.line_items)
      ? row.line_items
      : JSON.parse(row.line_items || "[]"),
  };
}

function normalizePayload(data, docNumber) {
  const lineItems = Array.isArray(data.line_items) ? data.line_items : [];
  const subtotal = roundMoney(
    lineItems.reduce((sum, row) => sum + Number(row.qty || 0) * Number(row.unit_price || 0), 0)
  );
  const discountAmount = roundMoney(Math.max(0, Number(data.discount_amount || 0)));
  const advanceAmount = roundMoney(Math.max(0, Number(data.advance_amount || 0)));
  const taxable = roundMoney(Math.max(0, subtotal - discountAmount));
  const taxRate = Number(data.tax_rate || 0);
  const taxAmount = roundMoney(taxable * (taxRate / 100));
  const total = roundMoney(Math.max(0, taxable + taxAmount - advanceAmount));

  return {
    type: data.type,
    doc_number: docNumber,
    issue_date: data.issue_date,
    due_date: data.due_date || null,
    client_name: data.client_name || "",
    client_address: data.client_address || "",
    client_phone: data.client_phone || "",
    client_email: data.client_email || "",
    line_items: lineItems.map((row) => ({
      description: row.description || "",
      qty: Number(row.qty) || 0,
      unit_price: Number(row.unit_price) || 0,
      amount: roundMoney((Number(row.qty) || 0) * (Number(row.unit_price) || 0)),
    })),
    subtotal,
    discount_amount: discountAmount,
    advance_amount: advanceAmount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total,
    notes: data.notes || "",
    general_line: data.type === "quotation" ? String(data.general_line || "").trim() : "",
    status: data.status || "draft",
  };
}

function normalizeCustomerPayload(data) {
  return {
    name: String(data.name || "").trim(),
    address: String(data.address || "").trim(),
    phone: String(data.phone || "").trim(),
    email: String(data.email || "").trim(),
  };
}

module.exports = {
  roundMoney,
  parseDocument,
  normalizePayload,
  normalizeCustomerPayload,
};
