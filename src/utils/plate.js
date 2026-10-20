// Registration numbers are stored uppercase with spaces, '-' and '.' stripped, so
// "ka 01 ab-1234" and "KA01AB1234" are the same car — the one-coupon-per-car
// check (coupon_usages.plate_number) depends on this.
const normalizePlate = (plate) => (plate && String(plate).toUpperCase().replace(/[\s.-]/g, '')) || null;

// Standard state series (KA01AB1234, DL3CAF0001, MH12A1234, GJ011234) or Bharat series (22BH1234AA).
const PLATE_RE = /^(?:[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$/;
const isValidPlate = (plate) => PLATE_RE.test(plate ?? '');
const PLATE_ERROR = 'Enter a valid registration number (e.g. KA01AB1234 or 22BH1234AA).';

module.exports = { normalizePlate, isValidPlate, PLATE_ERROR };
