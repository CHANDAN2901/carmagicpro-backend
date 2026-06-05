// Seed: Indian market car brands and models
// Prerequisites: VehicleTypes must exist (run `npm run seed` first)
// Usage: npm run seed:cars
// Idempotent: upserts on slug

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const brands = [
  { name: 'Maruti Suzuki',  slug: 'maruti-suzuki'  },
  { name: 'Hyundai',        slug: 'hyundai'        },
  { name: 'Tata',           slug: 'tata'           },
  { name: 'Mahindra',       slug: 'mahindra'       },
  { name: 'Honda',          slug: 'honda'          },
  { name: 'Toyota',         slug: 'toyota'         },
  { name: 'Kia',            slug: 'kia'            },
  { name: 'Renault',        slug: 'renault'        },
  { name: 'Volkswagen',     slug: 'volkswagen'     },
  { name: 'Skoda',          slug: 'skoda'          },
  { name: 'MG',             slug: 'mg'             },
  { name: 'Jeep',           slug: 'jeep'           },
  { name: 'BMW',            slug: 'bmw'            },
  { name: 'Mercedes-Benz',  slug: 'mercedes-benz'  },
  { name: 'Audi',           slug: 'audi'           },
  { name: 'Nissan',         slug: 'nissan'         },
  { name: 'Ford',           slug: 'ford'           },
];

// b = brand slug, vt = vehicleType slug, n = model name, f = fuel types
const models = [
  // ── Maruti Suzuki ──────────────────────────────────────────────────────────
  { b: 'maruti-suzuki', vt: 'hatchback',        n: 'Alto K10',       f: ['PETROL', 'CNG'] },
  { b: 'maruti-suzuki', vt: 'hatchback',        n: 'S-Presso',       f: ['PETROL', 'CNG'] },
  { b: 'maruti-suzuki', vt: 'hatchback',        n: 'Celerio',        f: ['PETROL', 'CNG'] },
  { b: 'maruti-suzuki', vt: 'hatchback',        n: 'WagonR',         f: ['PETROL', 'CNG'] },
  { b: 'maruti-suzuki', vt: 'hatchback',        n: 'Swift',          f: ['PETROL', 'CNG'] },
  { b: 'maruti-suzuki', vt: 'hatchback',        n: 'Baleno',         f: ['PETROL', 'CNG'] },
  { b: 'maruti-suzuki', vt: 'hatchback',        n: 'Ignis',          f: ['PETROL'] },
  { b: 'maruti-suzuki', vt: 'sedan',            n: 'Dzire',          f: ['PETROL', 'CNG'] },
  { b: 'maruti-suzuki', vt: 'sedan',            n: 'Ciaz',           f: ['PETROL', 'DIESEL'] },
  { b: 'maruti-suzuki', vt: 'compact-suv',      n: 'Vitara Brezza',  f: ['PETROL'] },
  { b: 'maruti-suzuki', vt: 'compact-suv',      n: 'Fronx',          f: ['PETROL', 'CNG'] },
  { b: 'maruti-suzuki', vt: 'compact-suv',      n: 'Jimny',          f: ['PETROL'] },
  { b: 'maruti-suzuki', vt: 'suv',              n: 'Grand Vitara',   f: ['PETROL', 'HYBRID'] },
  { b: 'maruti-suzuki', vt: 'mpv-muv',          n: 'Ertiga',         f: ['PETROL', 'CNG'] },
  { b: 'maruti-suzuki', vt: 'mpv-muv',          n: 'XL6',            f: ['PETROL', 'CNG'] },

  // ── Hyundai ───────────────────────────────────────────────────────────────
  { b: 'hyundai', vt: 'hatchback',   n: 'Grand i10 Nios',  f: ['PETROL', 'CNG'] },
  { b: 'hyundai', vt: 'hatchback',   n: 'i20',             f: ['PETROL', 'DIESEL'] },
  { b: 'hyundai', vt: 'sedan',       n: 'Aura',            f: ['PETROL', 'CNG', 'DIESEL'] },
  { b: 'hyundai', vt: 'sedan',       n: 'Verna',           f: ['PETROL', 'DIESEL'] },
  { b: 'hyundai', vt: 'compact-suv', n: 'Exter',           f: ['PETROL', 'CNG'] },
  { b: 'hyundai', vt: 'compact-suv', n: 'Venue',           f: ['PETROL', 'DIESEL', 'CNG'] },
  { b: 'hyundai', vt: 'suv',         n: 'Creta',           f: ['PETROL', 'DIESEL'] },
  { b: 'hyundai', vt: 'suv',         n: 'Alcazar',         f: ['PETROL', 'DIESEL'] },
  { b: 'hyundai', vt: 'suv',         n: 'Tucson',          f: ['PETROL', 'DIESEL'] },
  { b: 'hyundai', vt: 'electric-vehicle', n: 'Creta Electric', f: ['ELECTRIC'] },
  { b: 'hyundai', vt: 'electric-vehicle', n: 'Ioniq 5',     f: ['ELECTRIC'] },
  { b: 'hyundai', vt: 'electric-vehicle', n: 'Ioniq 6',     f: ['ELECTRIC'] },

  // ── Tata ──────────────────────────────────────────────────────────────────
  { b: 'tata', vt: 'hatchback',        n: 'Tiago',        f: ['PETROL', 'CNG'] },
  { b: 'tata', vt: 'electric-vehicle', n: 'Tiago EV',     f: ['ELECTRIC'] },
  { b: 'tata', vt: 'sedan',            n: 'Tigor',        f: ['PETROL', 'CNG'] },
  { b: 'tata', vt: 'electric-vehicle', n: 'Tigor EV',     f: ['ELECTRIC'] },
  { b: 'tata', vt: 'compact-suv',      n: 'Punch',        f: ['PETROL', 'CNG'] },
  { b: 'tata', vt: 'electric-vehicle', n: 'Punch EV',     f: ['ELECTRIC'] },
  { b: 'tata', vt: 'compact-suv',      n: 'Nexon',        f: ['PETROL', 'DIESEL', 'CNG'] },
  { b: 'tata', vt: 'electric-vehicle', n: 'Nexon EV',     f: ['ELECTRIC'] },
  { b: 'tata', vt: 'suv',              n: 'Harrier',      f: ['DIESEL'] },
  { b: 'tata', vt: 'suv',              n: 'Harrier EV',   f: ['ELECTRIC'] },
  { b: 'tata', vt: 'suv',              n: 'Safari',       f: ['DIESEL'] },
  { b: 'tata', vt: 'suv',              n: 'Curvv',        f: ['PETROL', 'DIESEL'] },
  { b: 'tata', vt: 'electric-vehicle', n: 'Curvv EV',     f: ['ELECTRIC'] },

  // ── Mahindra ──────────────────────────────────────────────────────────────
  { b: 'mahindra', vt: 'compact-suv', n: 'XUV 3XO',     f: ['PETROL', 'DIESEL'] },
  { b: 'mahindra', vt: 'suv',         n: 'XUV700',       f: ['PETROL', 'DIESEL'] },
  { b: 'mahindra', vt: 'suv',         n: 'Scorpio N',    f: ['PETROL', 'DIESEL'] },
  { b: 'mahindra', vt: 'suv',         n: 'Scorpio Classic', f: ['DIESEL'] },
  { b: 'mahindra', vt: 'suv',         n: 'Thar',         f: ['PETROL', 'DIESEL'] },
  { b: 'mahindra', vt: 'suv',         n: 'Thar Roxx',    f: ['PETROL', 'DIESEL'] },
  { b: 'mahindra', vt: 'suv',         n: 'Bolero',       f: ['DIESEL'] },
  { b: 'mahindra', vt: 'electric-vehicle', n: 'BE 6',    f: ['ELECTRIC'] },
  { b: 'mahindra', vt: 'electric-vehicle', n: 'XEV 9e',  f: ['ELECTRIC'] },

  // ── Honda ─────────────────────────────────────────────────────────────────
  { b: 'honda', vt: 'hatchback',   n: 'Jazz',          f: ['PETROL'] },
  { b: 'honda', vt: 'sedan',       n: 'Amaze',         f: ['PETROL', 'DIESEL'] },
  { b: 'honda', vt: 'sedan',       n: 'City',          f: ['PETROL', 'HYBRID'] },
  { b: 'honda', vt: 'compact-suv', n: 'WR-V',          f: ['PETROL', 'DIESEL'] },
  { b: 'honda', vt: 'suv',         n: 'Elevate',       f: ['PETROL'] },
  { b: 'honda', vt: 'mpv-muv',     n: 'BR-V',          f: ['PETROL'] },

  // ── Toyota ────────────────────────────────────────────────────────────────
  { b: 'toyota', vt: 'hatchback',   n: 'Glanza',        f: ['PETROL', 'CNG'] },
  { b: 'toyota', vt: 'sedan',       n: 'Yaris',         f: ['PETROL'] },
  { b: 'toyota', vt: 'compact-suv', n: 'Urban Cruiser Taisor', f: ['PETROL', 'CNG'] },
  { b: 'toyota', vt: 'compact-suv', n: 'Urban Cruiser Hyryder', f: ['PETROL', 'HYBRID'] },
  { b: 'toyota', vt: 'suv',         n: 'Fortuner',      f: ['PETROL', 'DIESEL'] },
  { b: 'toyota', vt: 'suv',         n: 'Hilux',         f: ['DIESEL'] },
  { b: 'toyota', vt: 'mpv-muv',     n: 'Innova Hycross', f: ['PETROL', 'HYBRID'] },
  { b: 'toyota', vt: 'mpv-muv',     n: 'Innova Crysta', f: ['DIESEL'] },
  { b: 'toyota', vt: 'mpv-muv',     n: 'Vellfire',      f: ['HYBRID'] },
  { b: 'toyota', vt: 'electric-vehicle', n: 'bZ4X',     f: ['ELECTRIC'] },

  // ── Kia ───────────────────────────────────────────────────────────────────
  { b: 'kia', vt: 'compact-suv',      n: 'Sonet',        f: ['PETROL', 'DIESEL', 'CNG'] },
  { b: 'kia', vt: 'suv',              n: 'Seltos',       f: ['PETROL', 'DIESEL'] },
  { b: 'kia', vt: 'mpv-muv',          n: 'Carens',       f: ['PETROL', 'DIESEL', 'CNG'] },
  { b: 'kia', vt: 'electric-vehicle', n: 'EV6',          f: ['ELECTRIC'] },
  { b: 'kia', vt: 'electric-vehicle', n: 'EV9',          f: ['ELECTRIC'] },

  // ── Renault ───────────────────────────────────────────────────────────────
  { b: 'renault', vt: 'hatchback',   n: 'Kwid',         f: ['PETROL', 'CNG'] },
  { b: 'renault', vt: 'compact-suv', n: 'Kiger',        f: ['PETROL'] },
  { b: 'renault', vt: 'mpv-muv',     n: 'Triber',       f: ['PETROL', 'CNG'] },

  // ── Volkswagen ────────────────────────────────────────────────────────────
  { b: 'volkswagen', vt: 'hatchback',   n: 'Polo',       f: ['PETROL'] },
  { b: 'volkswagen', vt: 'sedan',       n: 'Virtus',     f: ['PETROL'] },
  { b: 'volkswagen', vt: 'compact-suv', n: 'Taigun',     f: ['PETROL'] },

  // ── Skoda ─────────────────────────────────────────────────────────────────
  { b: 'skoda', vt: 'sedan',       n: 'Slavia',         f: ['PETROL'] },
  { b: 'skoda', vt: 'compact-suv', n: 'Kushaq',         f: ['PETROL'] },
  { b: 'skoda', vt: 'suv',         n: 'Kodiaq',         f: ['PETROL'] },

  // ── MG ────────────────────────────────────────────────────────────────────
  { b: 'mg', vt: 'compact-suv',      n: 'Astor',        f: ['PETROL'] },
  { b: 'mg', vt: 'suv',              n: 'Hector',       f: ['PETROL', 'DIESEL', 'HYBRID'] },
  { b: 'mg', vt: 'suv',              n: 'Hector Plus',  f: ['PETROL', 'DIESEL', 'HYBRID'] },
  { b: 'mg', vt: 'suv',              n: 'Gloster',      f: ['DIESEL'] },
  { b: 'mg', vt: 'electric-vehicle', n: 'ZS EV',        f: ['ELECTRIC'] },
  { b: 'mg', vt: 'electric-vehicle', n: 'Comet EV',     f: ['ELECTRIC'] },
  { b: 'mg', vt: 'electric-vehicle', n: 'Windsor EV',   f: ['ELECTRIC'] },

  // ── Jeep ──────────────────────────────────────────────────────────────────
  { b: 'jeep', vt: 'compact-suv', n: 'Compass',         f: ['PETROL', 'DIESEL'] },
  { b: 'jeep', vt: 'suv',         n: 'Wrangler',        f: ['PETROL'] },
  { b: 'jeep', vt: 'suv',         n: 'Grand Cherokee',  f: ['PETROL', 'DIESEL'] },
  { b: 'jeep', vt: 'suv',         n: 'Meridian',        f: ['DIESEL'] },

  // ── BMW ───────────────────────────────────────────────────────────────────
  { b: 'bmw', vt: 'sedan',       n: '3 Series',         f: ['PETROL', 'DIESEL'] },
  { b: 'bmw', vt: 'sedan',       n: '5 Series',         f: ['PETROL', 'DIESEL'] },
  { b: 'bmw', vt: 'suv',         n: 'X1',               f: ['PETROL', 'DIESEL'] },
  { b: 'bmw', vt: 'suv',         n: 'X3',               f: ['PETROL', 'DIESEL'] },
  { b: 'bmw', vt: 'suv',         n: 'X5',               f: ['PETROL', 'DIESEL', 'HYBRID'] },
  { b: 'bmw', vt: 'electric-vehicle', n: 'iX',          f: ['ELECTRIC'] },
  { b: 'bmw', vt: 'electric-vehicle', n: 'i4',          f: ['ELECTRIC'] },
  { b: 'bmw', vt: 'electric-vehicle', n: 'iX1',         f: ['ELECTRIC'] },

  // ── Mercedes-Benz ─────────────────────────────────────────────────────────
  { b: 'mercedes-benz', vt: 'sedan',  n: 'C-Class',     f: ['PETROL', 'DIESEL'] },
  { b: 'mercedes-benz', vt: 'sedan',  n: 'E-Class',     f: ['PETROL', 'DIESEL'] },
  { b: 'mercedes-benz', vt: 'suv',    n: 'GLA',         f: ['PETROL', 'DIESEL'] },
  { b: 'mercedes-benz', vt: 'suv',    n: 'GLC',         f: ['PETROL', 'DIESEL'] },
  { b: 'mercedes-benz', vt: 'suv',    n: 'GLE',         f: ['PETROL', 'DIESEL'] },
  { b: 'mercedes-benz', vt: 'electric-vehicle', n: 'EQB', f: ['ELECTRIC'] },
  { b: 'mercedes-benz', vt: 'electric-vehicle', n: 'EQS', f: ['ELECTRIC'] },

  // ── Audi ──────────────────────────────────────────────────────────────────
  { b: 'audi', vt: 'sedan',  n: 'A4',                   f: ['PETROL'] },
  { b: 'audi', vt: 'sedan',  n: 'A6',                   f: ['PETROL'] },
  { b: 'audi', vt: 'suv',    n: 'Q3',                   f: ['PETROL'] },
  { b: 'audi', vt: 'suv',    n: 'Q5',                   f: ['PETROL', 'HYBRID'] },
  { b: 'audi', vt: 'suv',    n: 'Q7',                   f: ['PETROL'] },
  { b: 'audi', vt: 'electric-vehicle', n: 'e-tron',     f: ['ELECTRIC'] },

  // ── Nissan ────────────────────────────────────────────────────────────────
  { b: 'nissan', vt: 'hatchback',   n: 'Magnite',       f: ['PETROL'] },
  { b: 'nissan', vt: 'compact-suv', n: 'Kicks',         f: ['PETROL', 'DIESEL'] },

  // ── Ford ──────────────────────────────────────────────────────────────────
  { b: 'ford', vt: 'hatchback',   n: 'Figo',            f: ['PETROL', 'DIESEL'] },
  { b: 'ford', vt: 'sedan',       n: 'Aspire',          f: ['PETROL', 'DIESEL'] },
  { b: 'ford', vt: 'compact-suv', n: 'EcoSport',        f: ['PETROL', 'DIESEL'] },
  { b: 'ford', vt: 'suv',         n: 'Endeavour',       f: ['DIESEL'] },
];

function toSlug(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function main() {
  console.log('🚗 Seeding car brands and models...\n');

  // Build vehicleType slug → id map
  const vtList = await prisma.vehicleType.findMany({ select: { id: true, slug: true } });
  const vtMap = Object.fromEntries(vtList.map((v) => [v.slug, v.id]));

  // Upsert brands
  let brandCount = 0;
  const brandMap = {};
  for (const brand of brands) {
    const result = await prisma.carBrand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name },
      create: { name: brand.name, slug: brand.slug },
    });
    brandMap[brand.slug] = result.id;
    brandCount++;
  }
  console.log(`✅ ${brandCount} car brands upserted`);

  // Upsert models
  let modelCount = 0;
  const failed = [];
  for (const m of models) {
    const brandId = brandMap[m.b];
    const vehicleTypeId = vtMap[m.vt];
    if (!brandId) { failed.push(`Brand not found: ${m.b}`); continue; }
    if (!vehicleTypeId) { failed.push(`VehicleType not found: ${m.vt} (model: ${m.n})`); continue; }

    const slug = toSlug(`${m.b}-${m.n}`);
    await prisma.carModel.upsert({
      where: { slug },
      update: { name: m.n, brandId, vehicleTypeId, fuelTypes: m.f },
      create: { name: m.n, slug, brandId, vehicleTypeId, fuelTypes: m.f },
    });
    modelCount++;
  }
  console.log(`✅ ${modelCount} car models upserted`);

  if (failed.length) {
    console.warn(`⚠️  ${failed.length} skipped:`);
    failed.forEach((f) => console.warn('  -', f));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
