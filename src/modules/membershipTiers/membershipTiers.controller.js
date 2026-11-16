// Admin: manage membership tiers (name, features, per-car-type MRP) and the
// plan discounts. Pricing itself lives in memberships/memberships.pricing.js.
const prisma = require('../../config/prisma');
const { getTiers, getDiscounts, setDiscounts } = require('../memberships/memberships.pricing');
const { createTierSchema, updateTierSchema, discountsSchema } = require('./membershipTiers.schema');

const toSlug = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const getAll = async (_req, res, next) => {
  try {
    const [tiers, discounts] = await Promise.all([getTiers(), getDiscounts()]);
    res.json({ success: true, tiers, discounts });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { prices = [], ...data } = createTierSchema.parse(req.body);
    // Slug is fixed at creation: it forms the stored planKey (e.g. COMPLETE_12).
    const slug = toSlug(data.name);
    if (!slug) throw Object.assign(new Error('Name must contain letters or numbers'), { statusCode: 400 });
    if (await prisma.membershipTier.findUnique({ where: { slug } })) {
      throw Object.assign(new Error('A plan with this name already exists'), { statusCode: 409 });
    }
    const tier = await prisma.membershipTier.create({
      data: { ...data, slug, prices: { create: prices } },
      include: { prices: true },
    });
    res.status(201).json({ success: true, tier });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { prices, ...data } = updateTierSchema.parse(req.body);
    const tier = await prisma.$transaction(async (tx) => {
      if (prices) {
        await tx.membershipTierPrice.deleteMany({ where: { tierId: req.params.id } });
        await tx.membershipTierPrice.createMany({ data: prices.map((p) => ({ ...p, tierId: req.params.id })) });
      }
      return tx.membershipTier.update({ where: { id: req.params.id }, data, include: { prices: true } });
    });
    res.json({ success: true, tier });
  } catch (err) {
    if (err?.code === 'P2025') return next(Object.assign(new Error('Plan not found'), { statusCode: 404 }));
    next(err);
  }
};

const updateDiscounts = async (req, res, next) => {
  try {
    const discounts = discountsSchema.parse(req.body);
    await setDiscounts(discounts);
    res.json({ success: true, discounts });
  } catch (err) { next(err); }
};

module.exports = { getAll, create, update, updateDiscounts };
