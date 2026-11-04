const PDFDocument = require('pdfkit');
const {
  SUPPORT_EMAIL, SUPPORT_NUMBER, WEBSITE_URL,
  BUSINESS_GSTIN, BUSINESS_LEGAL_NAME, BUSINESS_ADDRESS, BUSINESS_STATE, GST_RATE, SERVICE_SAC_CODE,
} = require('../config/env');

// ponytail: built-in Helvetica is WinAnsi-only, so amounts use "Rs." (no ₹ glyph)
// and non-Latin names won't render; embed a TTF via doc.registerFont if needed.
const money = (n) => `Rs. ${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const istDate = (d, withTime = false) => new Date(d).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
  ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
});
const round2 = (n) => Math.round(n * 100) / 100;

// Prices are GST-inclusive (what the customer pays), so the tax is backed out of
// the invoice total and split equally into CGST + SGST (intra-state supply).
// ponytail: the rate is read from config at render time and every supply is
// treated as intra-state — store invoice.taxRate at issue time if the rate ever
// changes, and add IGST if products start shipping out of state.
const gstBreakup = (total, rate) => {
  const taxable = round2((Number(total) * 100) / (100 + rate));
  const tax = round2(Number(total) - taxable);
  const cgst = round2(tax / 2);
  return { rate, taxable, cgst, sgst: round2(tax - cgst), tax };
};

const LEFT = 50;
const RIGHT = 545;
// Item table columns: [x, width, align]
const COLS = { item: [LEFT, 250, 'left'], qty: [300, 50, 'right'], price: [355, 90, 'right'], total: [450, 95, 'right'] };

const row = (doc, y, cells, opts = {}) => {
  for (const [key, text] of Object.entries(cells)) {
    const [x, width, align] = COLS[key];
    doc.text(text, x, y, { width, align, ...opts });
  }
};

// Streams an invoice (from invoices.service.getById) to the response as a PDF download.
const sendInvoicePdf = (res, invoice) => {
  const gst = BUSINESS_GSTIN ? gstBreakup(invoice.totalAmount, Number(invoice.taxRate ?? GST_RATE)) : null;

  const doc = new PDFDocument({ size: 'A4', margin: LEFT });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // Header: business on the left, invoice meta on the right
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#1a1a1a').text('Car Magic Pro', LEFT, 50, { width: 270 });
  doc.font('Helvetica').fontSize(9).fillColor('#555');
  if (gst) {
    if (BUSINESS_LEGAL_NAME) doc.text(BUSINESS_LEGAL_NAME, { width: 270 });
    if (BUSINESS_ADDRESS) doc.text(BUSINESS_ADDRESS, { width: 270 });
    doc.font('Helvetica-Bold').fillColor('#1a1a1a').text(`GSTIN: ${BUSINESS_GSTIN}`).font('Helvetica').fillColor('#555');
  }
  doc.text(WEBSITE_URL).text(`Email: ${SUPPORT_EMAIL ?? ''}`).text(`Phone: ${SUPPORT_NUMBER}`);
  const leftBottom = doc.y;

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a1a1a').text(gst ? 'TAX INVOICE' : 'INVOICE', 330, 50, { width: 215, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#555');
  const meta = [
    ['Invoice #', invoice.invoiceNumber],
    ['Date', istDate(invoice.issuedAt)],
    ['Type', invoice.entityType],
    ['Payment', [invoice.payment?.method, invoice.payment?.status === 'CAPTURED' ? 'PAID' : invoice.payment?.status].filter(Boolean).join(' · ')],
    ...(gst ? [['Place of supply', [BUSINESS_STATE, `(${BUSINESS_GSTIN.slice(0, 2)})`].filter(Boolean).join(' ')]] : []),
  ];
  let y = 76;
  for (const [label, value] of meta) {
    doc.text(`${label}: ${value || '—'}`, 330, y, { width: 215, align: 'right' });
    y += 13;
  }

  const headerBottom = Math.max(leftBottom, y) + 8;
  doc.moveTo(LEFT, headerBottom).lineTo(RIGHT, headerBottom).strokeColor('#dddddd').stroke();

  // Bill to
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#888').text('BILL TO', LEFT, headerBottom + 15);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a1a').text(invoice.user?.name || 'Customer', LEFT, headerBottom + 30);
  doc.font('Helvetica').fontSize(9).fillColor('#555');
  if (invoice.user?.phone) doc.text(invoice.user.phone);
  if (invoice.user?.email) doc.text(invoice.user.email);

  // Line items
  y = doc.y + 30;
  doc.rect(LEFT - 6, y - 6, RIGHT - LEFT + 12, 22).fill('#1a1a1a');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
  row(doc, y, { item: 'Item', qty: 'Qty', price: 'Price', total: 'Total' });
  y += 26;

  const sac = gst && invoice.entityType !== 'ORDER' && SERVICE_SAC_CODE ? `SAC: ${SERVICE_SAC_CODE}` : null;
  doc.font('Helvetica').fontSize(9).fillColor('#1a1a1a');
  for (const item of Array.isArray(invoice.lineItemsSnapshot) ? invoice.lineItemsSnapshot : []) {
    const sub = [sac, item.sku && `SKU: ${item.sku}`, item.scheduledAt && `Scheduled: ${istDate(item.scheduledAt, true)}`]
      .filter(Boolean).join('  ');
    const name = item.name ?? 'Item';
    const h = doc.heightOfString(name, { width: COLS.item[1] }) + (sub ? 12 : 0);
    if (y + h > 740) { doc.addPage(); y = 50; }

    row(doc, y, { item: name, qty: String(item.quantity ?? 1), price: money(item.unitPrice), total: money(item.total) });
    if (sub) doc.fontSize(8).fillColor('#888').text(sub, LEFT, y + h - 10, { width: COLS.item[1] }).fontSize(9).fillColor('#1a1a1a');
    y += h + 8;
    doc.moveTo(LEFT, y - 4).lineTo(RIGHT, y - 4).strokeColor('#eeeeee').stroke();
  }

  // Totals
  if (y > 660) { doc.addPage(); y = 50; }
  y += 8;
  const totals = [['Subtotal', money(invoice.subtotal)]];
  if (Number(invoice.discountAmount) > 0) {
    totals.push([`Discount${invoice.couponCode ? ` (${invoice.couponCode})` : ''}`, `- ${money(invoice.discountAmount)}`]);
  }
  if (gst) {
    totals.push(
      ['Taxable value', money(gst.taxable)],
      [`CGST @ ${gst.rate / 2}%`, money(gst.cgst)],
      [`SGST @ ${gst.rate / 2}%`, money(gst.sgst)],
    );
  } else if (Number(invoice.taxAmount) > 0) {
    totals.push([`Tax (${invoice.taxLabel ?? 'GST'})`, money(invoice.taxAmount)]);
  }
  for (const [label, value] of totals) {
    doc.font('Helvetica').fontSize(9).fillColor('#555').text(label, 300, y, { width: 145, align: 'right' });
    doc.text(value, 450, y, { width: 95, align: 'right' });
    y += 15;
  }
  doc.moveTo(300, y).lineTo(RIGHT, y).strokeColor('#dddddd').stroke();
  y += 8;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a1a').text(gst ? 'Total (incl. GST)' : 'Total', 300, y, { width: 145, align: 'right' });
  doc.text(money(invoice.totalAmount), 450, y, { width: 95, align: 'right' });

  doc.font('Helvetica').fontSize(8).fillColor('#888')
    .text(`${gst ? 'Prices are inclusive of GST. ' : ''}Thank you for choosing Car Magic Pro. This is a computer-generated invoice and does not require a signature.`,
      LEFT, y + 50, { width: RIGHT - LEFT, align: 'center' });

  doc.end();
};

module.exports = { sendInvoicePdf, gstBreakup };
