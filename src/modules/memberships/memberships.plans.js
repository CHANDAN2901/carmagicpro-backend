// ─── Static annual membership plans (source of truth) ────────────────────────
// Plans are intentionally hard-coded — there is no plan-catalog table. Each plan
// is a tier (Essential / Complete / Luxury) crossed with a yearly wash cadence:
//   *_12 = 1 wash / month  → 12 washes / year
//   *_24 = 2 washes / month → 24 washes / year
// Prices mirror the customer MembershipPage cards. This is the authoritative copy
// the server prices from — the client price is never trusted.

const PLANS = {
  ESSENTIAL_12: { planKey: 'ESSENTIAL_12', name: 'Essential Care — 12 Care / 1 Year', tier: 'Essential Care', washesPerYear: 12, price: 9590 },
  ESSENTIAL_24: { planKey: 'ESSENTIAL_24', name: 'Essential Care — 24 Care / 1 Year', tier: 'Essential Care', washesPerYear: 24, price: 16783 },
  COMPLETE_12: { planKey: 'COMPLETE_12', name: 'Complete Care — 12 Care / 1 Year', tier: 'Complete Care', washesPerYear: 12, price: 15350 },
  COMPLETE_24: { planKey: 'COMPLETE_24', name: 'Complete Care — 24 Care / 1 Year', tier: 'Complete Care', washesPerYear: 24, price: 26863 },
  LUXURY_12: { planKey: 'LUXURY_12', name: 'Luxury Care — 12 Care / 1 Year', tier: 'Luxury Care', washesPerYear: 12, price: 47990 },
  LUXURY_24: { planKey: 'LUXURY_24', name: 'Luxury Care — 24 Care / 1 Year', tier: 'Luxury Care', washesPerYear: 24, price: 83983 },
};

const PLAN_KEYS = Object.keys(PLANS);

const getPlan = (planKey) => PLANS[planKey] ?? null;

module.exports = { PLANS, PLAN_KEYS, getPlan };
