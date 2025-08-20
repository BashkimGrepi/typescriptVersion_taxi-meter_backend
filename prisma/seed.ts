// prisma/seed.ts
import { PrismaClient, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const prisma = new PrismaClient();

// Defaults (env first, fallbacks)
const BASE_FARE  = process.env.DEFAULT_BASE_FARE  ?? '3.00'; // Decimal(10,2)
const PER_MINUTE = process.env.DEFAULT_PER_MINUTE ?? '0.50'; // Decimal(10,4)
const PER_KM     = process.env.DEFAULT_PER_KM     ?? '1.10'; // Decimal(10,4)

const dec = (n: string | number) => new Prisma.Decimal(n);

// 1) Admin user (your existing logic)
async function ensureAdminUser() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const user = await (prisma as any).user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      username: 'admin',
      status: 'ACTIVE',
    },
  });
  return user as { id: string; email: string };
}

// 2) Ensure one active PricingPolicy per tenant
async function ensureDefaultPolicy(tenantId: string) {
  await prisma.pricingPolicy.upsert({
    // upsert on the compound unique key [tenantId, isActive]
    where: { tenantId_isActive: { tenantId, isActive: true } },
    update: {
      name: 'Default',
      baseFare:  dec(BASE_FARE),
      perMinute: dec(PER_MINUTE),
      perKm:     dec(PER_KM),
      validFrom: new Date(),
      validTo:   null,
      isActive:  true,
    },
    create: {
      tenantId,
      name: 'Default',
      baseFare:  dec(BASE_FARE),
      perMinute: dec(PER_MINUTE),
      perKm:     dec(PER_KM),
      validFrom: new Date(),
      isActive:  true,
    },
  });
}

async function main() {
  await ensureAdminUser();

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  for (const t of tenants) {
    await ensureDefaultPolicy(t.id);
    console.log(`✅ Ensured default pricing policy for tenant: ${t.name}`);
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
