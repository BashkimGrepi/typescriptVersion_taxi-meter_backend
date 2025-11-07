/* eslint-disable no-console */
import { PrismaClient, Role, RideStatus, PaymentProvider, PaymentStatus, NumberSequenceType, ExportArchiveType, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// --- Small date helpers ---
const now = new Date();
function yyyymm(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

// --- Money helper: store as string to avoid float issues ---
const money = (n: number) => n.toFixed(2);

// --- Numbering helpers (Receipt/Invoice numbers per period) ---
async function nextNumber(tenantId: string, type: NumberSequenceType, period: string) {
  const seq = await prisma.numberSequence.upsert({
    where: { tenantId_type_period: { tenantId, type, period } },
    update: { current: { increment: 1 } },
    create: { tenantId, type, period, current: 1 },
  });
  return seq.current.toString().padStart(4, '0'); // e.g., 0001
}
function formatReceiptNumber(period: string, n: string) {
  return `R-${period}-${n}`;
}
function formatInvoiceNumber(period: string, n: string) {
  return `I-${period}-${n}`;
}

// Create rides + (optionally) a paid payment with numbered receipt/invoice
async function createRideWithOptionalPayment(params: {
  tenantId: string;
  driverProfileId: string;
  pricingPolicyId: string | null;
  startedAt: Date;
  durationMin: number;
  distanceKm: number;
  status: RideStatus;
  paid?: boolean; // if true -> create Payment with numbering
  provider?: PaymentProvider;
}) {
  const { tenantId, driverProfileId, pricingPolicyId, startedAt, durationMin, distanceKm, status, paid, provider } = params;

  const endedAt = status === RideStatus.ONGOING ? null : addMinutes(startedAt, durationMin);
  const fareSubtotal = 5 + 0.75 * durationMin + 1.10 * distanceKm; // simple formula for demo
  const taxAmount = fareSubtotal * 0.14; // 14% VAT for taxi transport per your earlier notes
  const fareTotal = fareSubtotal + taxAmount;

  const ride = await prisma.ride.create({
    data: {
      tenantId,
      driverProfileId,
      pricingPolicyId: pricingPolicyId ?? undefined,
      startedAt,
      endedAt,
      durationMin: `${durationMin}`,
      distanceKm: distanceKm.toFixed(3),
      fareSubtotal: money(fareSubtotal),
      taxAmount: money(taxAmount),
      fareTotal: money(fareTotal),
      status,
    },
  });

  // Create a payment if asked
  if (paid) {
    const period = yyyymm(endedAt ?? now);
    const receiptSeq = await nextNumber(tenantId, NumberSequenceType.RECEIPT, period);
    const invoiceSeq = await nextNumber(tenantId, NumberSequenceType.INVOICE, period);

    await prisma.payment.create({
      data: {
        tenantId,
        rideId: ride.id,
        provider: provider ?? PaymentProvider.STRIPE,
        amount: money(fareTotal),
        currency: 'EUR',
        status: PaymentStatus.PAID,
        authorizedAt: startedAt,
        capturedAt: endedAt ?? now,
        externalPaymentId: provider === PaymentProvider.STRIPE ? `pi_${ride.id.slice(0, 8)}` : `viva_${ride.id.slice(0, 8)}`,
        numberPeriod: period,
        receiptNumber: formatReceiptNumber(period, receiptSeq),
        invoiceNumber: formatInvoiceNumber(period, invoiceSeq),
      },
    });

    await prisma.paymentLink.create({
      data: {
        rideId: ride.id,
        provider: provider ?? PaymentProvider.STRIPE,
        url: `https://pay.example/${ride.id}`,
        status: 'CONSUMED',
        createdAt: startedAt,
        expiresAt: addMinutes(startedAt, 60),
      },
    });
  } else {
    // Add a link that remains ACTIVE for pending/uncaptured flows
    await prisma.paymentLink.create({
      data: {
        rideId: ride.id,
        provider: PaymentProvider.VIVA,
        url: `https://terminal.example/${ride.id}`,
        status: 'ACTIVE',
        createdAt: startedAt,
        expiresAt: addMinutes(startedAt, 120),
      },
    });
  }

  return ride;
}

async function main() {
  console.log('Seeding database…');

  // Optional: clean tables for deterministic seeding in dev
  // Comment these out if you keep real data locally.

  await prisma.exportArchive.deleteMany();
  await prisma.numberSequence.deleteMany();
  await prisma.paymentLink.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.pricingPolicy.deleteMany();
  await prisma.driverProfile.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.providerAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // Create tenants
  const [t1, t2] = await Promise.all([
    prisma.tenant.create({
      data: {
        name: 'MetroTaxi Oy',
        businessId: '1234567-8',
        settingsJson: { nightSurcharge: 1.25 },
      },
    }),
    prisma.tenant.create({
      data: {
        name: 'CityCab Oy',
        businessId: '9876543-1',
        settingsJson: { nightSurcharge: 1.15 },
      },
    }),
  ]);

  // Admin + Manager + (optional) Driver Users
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const [admin, manager, userDriver] = await Promise.all([
    prisma.user.create({
      data: { email: 'admin@metrotaxi.test', passwordHash, status: 'ACTIVE', role: Role.ADMIN, tenantId: t1.id },
    }),
    prisma.user.create({
      data: { email: 'manager@metrotaxi.test', passwordHash, status: 'ACTIVE', role: Role.MANAGER, tenantId: t1.id },
    }),
    prisma.user.create({
      data: { email: 'driver.user@metrotaxi.test', passwordHash, role: Role.DRIVER, status: UserStatus.ACTIVE, tenantId: t1.id },
    }),
  ]);

 
  // Driver profiles (one linked to a user, one invited-only)
  const driverA = await prisma.driverProfile.create({
    data: {
      tenantId: t1.id,
      userId: userDriver.id, // linked driver
      firstName: 'Anna',
      lastName: 'Kuljettaja',
      phone: '+358401234567',
      email: 'driver.user@metrotaxi.test',
      status: 'ACTIVE',
    },
  });

  

 

  // Pricing policies (enforce single active per tenant)
  const pricing1 = await prisma.pricingPolicy.create({
    data: {
      tenantId: t1.id,
      name: 'Default 2025',
      baseFare: '5.00',
      perKm: '1.1000',
      isActive: true,
    },
  });

  await prisma.pricingPolicy.create({
    data: {
      tenantId: t1.id,
      name: 'Old 2024',
      baseFare: '4.50',
      perKm: '1.0000',
      perMin: '0.60',
      isActive: false,
    },
  });

  const pricing2 = await prisma.pricingPolicy.create({
    data: {
      tenantId: t2.id,
      name: 'City 2025',
      baseFare: '4.75',
      perKm: '1.0500',
      perMin: '0.70',
      isActive: true,
    },
  });

  // Provider accounts (Stripe + Viva per tenant)
  await Promise.all([
    prisma.providerAccount.create({
      data: {
        tenantId: t1.id,
        provider: PaymentProvider.STRIPE,
        externalAccountId: 'acct_1MetroTaxi',
        connectedAt: daysAgo(20),
        livemode: false,
        metadataJson: { displayName: 'MetroTaxi Stripe' },
      },
    }),
    prisma.providerAccount.create({
      data: {
        tenantId: t1.id,
        provider: PaymentProvider.VIVA,
        externalAccountId: 'viva_merchant_metrotaxi',
        connectedAt: daysAgo(18),
        livemode: false,
        metadataJson: { terminalType: 'Tap-on-Phone' },
      },
    }),
    prisma.providerAccount.create({
      data: {
        tenantId: t2.id,
        provider: PaymentProvider.STRIPE,
        externalAccountId: 'acct_1CityCab',
        connectedAt: daysAgo(30),
        livemode: false,
        metadataJson: { displayName: 'CityCab Stripe' },
      },
    }),
  ]);

  // Rides for T1 (mix of statuses; some paid)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Completed + paid (Stripe)
  await createRideWithOptionalPayment({
    tenantId: t1.id,
    driverProfileId: driverA.id,
    pricingPolicyId: pricing1.id,
    startedAt: addMinutes(thisMonthStart, 60), // this month
    durationMin: 18,
    distanceKm: 6.2,
    status: RideStatus.COMPLETED,
    paid: true,
    provider: PaymentProvider.STRIPE,
  });

  // Completed + paid (Viva)
  await createRideWithOptionalPayment({
    tenantId: t1.id,
    driverProfileId: driverA.id,
    pricingPolicyId: pricing1.id,
    startedAt: addMinutes(thisMonthStart, 180),
    durationMin: 27,
    distanceKm: 11.4,
    status: RideStatus.COMPLETED,
    paid: true,
    provider: PaymentProvider.VIVA,
  });

  // Ongoing (no payment yet)
  await createRideWithOptionalPayment({
    tenantId: t1.id,
    driverProfileId: driverA.id,
    pricingPolicyId: pricing1.id,
    startedAt: addMinutes(now, -20),
    durationMin: 45,
    distanceKm: 14.9,
    status: RideStatus.ONGOING,
  });

  // Draft
  await createRideWithOptionalPayment({
    tenantId: t1.id,
    driverProfileId: driverA.id,
    pricingPolicyId: pricing1.id,
    startedAt: addMinutes(now, -120),
    durationMin: 14,
    distanceKm: 16.6,
    status: RideStatus.DRAFT,
  });

  // Last month paid (Stripe)
  await createRideWithOptionalPayment({
    tenantId: t1.id,
    driverProfileId: driverA.id,
    pricingPolicyId: pricing1.id,
    startedAt: addMinutes(lastMonthStart, 90),
    durationMin: 22,
    distanceKm: 7.5,
    status: RideStatus.COMPLETED,
    paid: true,
    provider: PaymentProvider.STRIPE,
  });

 

  await createRideWithOptionalPayment({
    tenantId: t2.id,
    driverProfileId: driverA.id,
    pricingPolicyId: pricing2.id,
    startedAt: addMinutes(thisMonthStart, 240),
    durationMin: 30,
    distanceKm: 9.3,
    status: RideStatus.COMPLETED,
    paid: true,
    provider: PaymentProvider.STRIPE,
  });

  await createRideWithOptionalPayment({
    tenantId: t2.id,
    driverProfileId: driverA.id,
    pricingPolicyId: pricing2.id,
    startedAt: addMinutes(now, -180),
    durationMin: 15,
    distanceKm: 4.2,
    status: RideStatus.CANCELLED,
  });

  // Export archives for “this month” per tenant (rough aggregates just for demo)
  for (const tenant of [t1, t2]) {
    const period = yyyymm(now);

    const paidThisMonth = await prisma.payment.findMany({
      where: { tenantId: tenant.id, numberPeriod: period, status: PaymentStatus.PAID },
      select: { amount: true },
    });

    const totalAmount = paidThisMonth.reduce((sum, p) => sum + Number(p.amount), 0);
    await prisma.exportArchive.create({
      data: {
        tenantId: tenant.id,
        period,
        type: ExportArchiveType.simplified,
        createdByUserId: admin.id,
        pdfPath: `/exports/${tenant.name}-${period}-simplified.pdf`,
        jsonPath: `/exports/${tenant.name}-${period}-simplified.json`,
        sha256: 'demo_sha256_placeholder',
        count: paidThisMonth.length,
        totalAmount: money(totalAmount),
      },
    });
  }


  console.log('Seeding complete ✅');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
