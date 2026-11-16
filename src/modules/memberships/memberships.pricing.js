// ─── Membership pricing (server source of truth) ─────────────────────────────
// Tiers (Essential / Complete / Luxury ...) live in membership_tiers and are
// managed from the CRM. Each tier has a per-wash MRP per car type (falling back
// to its defaultMrp). A membership is either:
//   FIXED  — one tier × 12 or 24 washes/year, discounted by discounts[12|24]
//   CUSTOM — a mix of tiers (12–24 washes total), discounted by discounts.custom
// price = round(Σ mrp × washes × (1 − discount%)). The client price is never trusted.

const prisma = require('../../config/prisma');

const DISCOUNTS_KEY = 'membership_discounts';
const DEFAULT_DISCOUNTS = { 12: 20, 24: 30, custom: 20 };
const FIXED_WASHES = [12, 24];
const CUSTOM_RANGE = { min: 12, max: 24 };

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

// ─── Pure helpers (tiers come with their `prices` rows) ──────────────────────

const mrpFor = (tier, vehicleTypeId) =>
  Number(tier.prices?.find((p) => p.vehicleTypeId === vehicleTypeId)?.mrp ?? tier.defaultMrp);

const discounted = (amount, pct) => Math.round((amount * (100 - pct)) / 100);

const planKeyFor = (tier, washes) => `${tier.slug.toUpperCase().replace(/-/g, '_')}_${washes}`;

const quoteFixed = (tier, washes, vehicleTypeId, discounts) => {
  const mrp = mrpFor(tier, vehicleTypeId);
  const mrpTotal = mrp * washes;
  const discountPct = Number(discounts[washes]);
  return {
    planKey: planKeyFor(tier, washes),
    name: `${tier.name} — ${washes} Care / 1 Year`,
    washesPerYear: washes,
    mrpTotal,
    discountPct,
    price: discounted(mrpTotal, discountPct),
    planItems: [{ tierId: tier.id, name: tier.name, count: washes, mrp }],
  };
};

// items: [{ tierId, count }] — only active tiers (the `tiers` passed in) are allowed.
const quoteCustom = (tiers, items, vehicleTypeId, discounts) => {
  const counts = new Map();
  for (const { tierId, count } of items) counts.set(tierId, (counts.get(tierId) ?? 0) + count);

  const planItems = [];
  for (const [tierId, count] of counts) {
    if (count <= 0) continue;
    const tier = tiers.find((t) => t.id === tierId);
    if (!tier) throw badRequest('One of the selected care plans is not available');
    planItems.push({ tierId, name: tier.name, count, mrp: mrpFor(tier, vehicleTypeId), sortOrder: tier.sortOrder });
  }
  planItems.sort((a, b) => a.sortOrder - b.sortOrder);
  planItems.forEach((i) => delete i.sortOrder);

  const washesPerYear = planItems.reduce((s, i) => s + i.count, 0);
  if (washesPerYear < CUSTOM_RANGE.min || washesPerYear > CUSTOM_RANGE.max) {
    throw badRequest(`Custom plan must have ${CUSTOM_RANGE.min}–${CUSTOM_RANGE.max} washes in total`);
  }

  const mrpTotal = planItems.reduce((s, i) => s + i.mrp * i.count, 0);
  const discountPct = Number(discounts.custom);
  return {
    planKey: 'CUSTOM',
    name: `Custom Care — ${planItems.map((i) => `${i.count} ${i.name}`).join(' + ')} / 1 Year`,
    washesPerYear,
    mrpTotal,
    discountPct,
    price: discounted(mrpTotal, discountPct),
    planItems,
  };
};

// Public catalog for one car type: what the website renders.
const buildCatalog = (tiers, discounts, vehicleTypeId) => ({
  discounts,
  custom: CUSTOM_RANGE,
  tiers: tiers.map((tier) => ({
    id: tier.id,
    slug: tier.slug,
    name: tier.name,
    description: tier.description,
    features: tier.features,
    mrp: mrpFor(tier, vehicleTypeId),
    plans: FIXED_WASHES.map((w) => {
      const { planKey, mrpTotal, discountPct, price } = quoteFixed(tier, w, vehicleTypeId, discounts);
      return { planKey, washes: w, mrpTotal, discountPct, price };
    }),
  })),
});

// ─── DB-backed ───────────────────────────────────────────────────────────────

const getDiscounts = async () => {
  const row = await prisma.appSetting.findUnique({ where: { key: DISCOUNTS_KEY } });
  if (!row) return { ...DEFAULT_DISCOUNTS };
  try {
    return { ...DEFAULT_DISCOUNTS, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULT_DISCOUNTS };
  }
};

const setDiscounts = (discounts) =>
  prisma.appSetting.upsert({
    where: { key: DISCOUNTS_KEY },
    update: { value: JSON.stringify(discounts) },
    create: { key: DISCOUNTS_KEY, value: JSON.stringify(discounts) },
  });

const getTiers = ({ activeOnly = false } = {}) =>
  prisma.membershipTier.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    include: { prices: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

const getCatalog = async (vehicleTypeId) => {
  const [tiers, discounts] = await Promise.all([getTiers({ activeOnly: true }), getDiscounts()]);
  return buildCatalog(tiers, discounts, vehicleTypeId);
};

// plan: { planType: 'FIXED', tierId, washes } | { planType: 'CUSTOM', items }
const quotePlan = async (plan, vehicleTypeId) => {
  const [tiers, discounts] = await Promise.all([getTiers({ activeOnly: true }), getDiscounts()]);
  if (plan.planType === 'CUSTOM') return quoteCustom(tiers, plan.items, vehicleTypeId, discounts);
  const tier = tiers.find((t) => t.id === plan.tierId);
  if (!tier) throw badRequest('This plan is not available');
  return quoteFixed(tier, plan.washes, vehicleTypeId, discounts);
};

module.exports = { DEFAULT_DISCOUNTS, FIXED_WASHES, CUSTOM_RANGE, getDiscounts, setDiscounts, getTiers, getCatalog, quotePlan };

// Self-check: `node src/modules/memberships/memberships.pricing.js` (no DB needed).
if (require.main === module) {
  const assert = require('node:assert');
  const SEDAN = 'sedan-id';
  const tier = (id, slug, name, defaultMrp, sedan, sortOrder) =>
    ({ id, slug, name, defaultMrp, sortOrder, prices: [{ vehicleTypeId: SEDAN, mrp: sedan }] });
  const tiers = [
    tier('e', 'essential', 'Essential Care', 999, 1099, 1),
    tier('c', 'complete', 'Complete Care', 1599, 1799, 2),
    tier('l', 'luxury', 'Luxury Care', 4999, 5499, 3),
  ];
  const d = DEFAULT_DISCOUNTS;

  // Default (Hatchback) prices = what the website showed before this change.
  const prices = buildCatalog(tiers, d, 'hatchback-id').tiers.flatMap((t) => t.plans.map((p) => [p.planKey, p.price]));
  assert.deepStrictEqual(Object.fromEntries(prices), {
    ESSENTIAL_12: 9590, ESSENTIAL_24: 16783, COMPLETE_12: 15350, COMPLETE_24: 26863, LUXURY_12: 47990, LUXURY_24: 83983,
  });
  assert.strictEqual(quoteFixed(tiers[1], 12, SEDAN, d).price, 17270);

  const custom = quoteCustom(tiers, [{ tierId: 'l', count: 2 }, { tierId: 'c', count: 10 }, { tierId: 'e', count: 0 }], SEDAN, d);
  assert.strictEqual(custom.price, 23190);
  assert.strictEqual(custom.washesPerYear, 12);
  assert.strictEqual(custom.name, 'Custom Care — 10 Complete Care + 2 Luxury Care / 1 Year');
  assert.throws(() => quoteCustom(tiers, [{ tierId: 'c', count: 5 }], SEDAN, d), /12–24/);
  assert.throws(() => quoteCustom(tiers, [{ tierId: 'gone', count: 12 }], SEDAN, d), /not available/);
  console.log('memberships.pricing self-check OK');
}
