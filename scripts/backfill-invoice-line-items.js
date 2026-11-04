// One-off: invoices for manual bookings/memberships were saved with an empty item
// list (the snapshot was read outside the creating transaction). Rebuild them.
// Run on the server:  node scripts/backfill-invoice-line-items.js [--dry-run]
const { PrismaClient } = require('@prisma/client');
const { buildLineItemsSnapshot } = require('../src/modules/payments/payments.service');

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

(async () => {
  const invoices = await prisma.invoice.findMany({
    where: { lineItemsSnapshot: { equals: [] } },
    select: { id: true, invoiceNumber: true, entityType: true, entityId: true },
  });
  console.log(`${invoices.length} invoice(s) with no line items${dryRun ? ' (dry run)' : ''}`);
  for (const inv of invoices) {
    const items = await buildLineItemsSnapshot(prisma, inv.entityType, inv.entityId);
    console.log(`  ${inv.invoiceNumber}: ${items.length ? items.map((i) => i.name).join(', ') : 'source record missing, skipped'}`);
    if (!dryRun && items.length) {
      await prisma.invoice.update({ where: { id: inv.id }, data: { lineItemsSnapshot: items } });
    }
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
