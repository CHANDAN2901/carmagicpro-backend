const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.$queryRaw`SELECT id, email, password_hash, is_verified, created_at FROM admins`;

  if (admins.length === 0) {
    console.log('No admins found — nothing to migrate.');
    return;
  }

  for (const admin of admins) {
    await prisma.$executeRaw`
      INSERT INTO users (id, name, email, password_hash, is_verified, is_active, created_at, updated_at)
      VALUES (
        ${admin.id},
        'Admin',
        ${admin.email},
        ${admin.password_hash},
        ${admin.is_verified},
        true,
        ${admin.created_at},
        NOW()
      )
      ON CONFLICT (email) DO NOTHING
    `;
    console.log(`Migrated admin: ${admin.email}`);
  }

  console.log(`Done. Migrated ${admins.length} admin(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
