const PDFDocument = require('pdfkit');
const { SUPPORT_EMAIL, SUPPORT_NUMBER, WEBSITE_URL } = require('../config/env');

// ponytail: built-in Helvetica is WinAnsi-only, so amounts use "Rs." (no ₹ glyph)
// and non-Latin names won't render; embed a TTF via doc.registerFont if needed.
const money = (n) => `Rs. ${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const istDate = (d, withTime = false) => new Date(d).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
  ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
});

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
  const doc = new PDFDocument({ size: 'A4', margin: LEFT });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // Header: business on the left, invoice meta on the right
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#1a1a1a').text('Car Magic Pro', LEFT, 50);
  doc.font('Helvetica').fontSize(9).fillColor('#555')
    .text(WEBSITE_URL).text(`Email: ${SUPPORT_EMAIL ?? ''}`).text(`Phone: ${SUPPORT_NUMBER}`);

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a1a1a').text('INVOICE', 350, 50, { width: 195, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#555');
  const meta = [
    ['Invoice #', invoice.invoiceNumber],
    ['Date', istDate(invoice.issuedAt)],
    ['Type', invoice.entityType],
    ['Payment', [invoice.payment?.method, invoice.payment?.status === 'CAPTURED' ? 'PAID' : invoice.payment?.status].filter(Boolean).join(' · ')],
  ];
  let y = 76;
  for (const [label, value] of meta) {
    doc.text(`${label}: ${value || '—'}`, 350, y, { width: 195, align: 'right' });
    y += 13;
  }

  doc.moveTo(LEFT, 135).lineTo(RIGHT, 135).strokeColor('#dddddd').stroke();

  // Bill to
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#888').text('BILL TO', LEFT, 150);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a1a').text(invoice.user?.name || 'Customer', LEFT, 165);
  doc.font('Helvetica').fontSize(9).fillColor('#555');
  if (invoice.user?.phone) doc.text(invoice.user.phone);
  if (invoice.user?.email) doc.text(invoice.user.email);

  // Line items
  y = 225;
  doc.rect(LEFT - 6, y - 6, RIGHT - LEFT + 12, 22).fill('#1a1a1a');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
  row(doc, y, { item: 'Item', qty: 'Qty', price: 'Price', total: 'Total' });
  y += 26;

  doc.font('Helvetica').fontSize(9).fillColor('#1a1a1a');
  for (const item of Array.isArray(invoice.lineItemsSnapshot) ? invoice.lineItemsSnapshot : []) {
    const sub = [item.sku && `SKU: ${item.sku}`, item.scheduledAt && `Scheduled: ${istDate(item.scheduledAt, true)}`]
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
  if (y > 680) { doc.addPage(); y = 50; }
  y += 8;
  const totals = [['Subtotal', money(invoice.subtotal)]];
  if (Number(invoice.discountAmount) > 0) {
    totals.push([`Discount${invoice.couponCode ? ` (${invoice.couponCode})` : ''}`, `- ${money(invoice.discountAmount)}`]);
  }
  if (Number(invoice.taxAmount) > 0) totals.push([`Tax (${invoice.taxLabel ?? 'GST'})`, money(invoice.taxAmount)]);
  for (const [label, value] of totals) {
    doc.font('Helvetica').fontSize(9).fillColor('#555').text(label, 330, y, { width: 115, align: 'right' });
    doc.text(value, 450, y, { width: 95, align: 'right' });
    y += 15;
  }
  doc.moveTo(330, y).lineTo(RIGHT, y).strokeColor('#dddddd').stroke();
  y += 8;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a1a').text('Total', 330, y, { width: 115, align: 'right' });
  doc.text(money(invoice.totalAmount), 450, y, { width: 95, align: 'right' });

  doc.font('Helvetica').fontSize(8).fillColor('#888')
    .text('Thank you for choosing Car Magic Pro. This is a computer-generated invoice and does not require a signature.',
      LEFT, y + 50, { width: RIGHT - LEFT, align: 'center' });

  doc.end();
};

module.exports = { sendInvoicePdf };
