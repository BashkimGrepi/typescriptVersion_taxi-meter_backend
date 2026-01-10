import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create or reuse First Tenant (Helsinki)
  const helsinkiTenant =
    (await prisma.tenant.findFirst({
      where: { businessId: '1234567-8' },
    })) ??
    (await prisma.tenant.create({
      data: {
        name: 'Helsinki Taxi Company',
        businessId: '1234567-8', // Finnish Y-tunnus format
        settingsJson: {
          surcharges: [
            {
              start: '22:00',
              end: '06:00',
              multiplier: '1.5',
            },
          ],
          taxRate: '0.24',
        },
      },
    }));
  console.log('✅ Using tenant:', helsinkiTenant.name);

  // Create or reuse Second Tenant (Tampere)
  const tampereTenant =
    (await prisma.tenant.findFirst({
      where: { businessId: '9876543-2' },
    })) ??
    (await prisma.tenant.create({
      data: {
        name: 'Tampere Taxi Service',
        businessId: '9876543-2', // Finnish Y-tunnus format
        settingsJson: {
          surcharges: [
            {
              start: '23:00',
              end: '05:00',
              multiplier: '1.3',
            },
          ],
          taxRate: '0.24',
        },
      },
    }));
  console.log('✅ Using tenant:', tampereTenant.name);

  // Create or reuse Admin User (email is unique)
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@helsinkitaxi.fi' },
    create: {
      email: 'admin@helsinkitaxi.fi',
      username: 'admin',
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
    },
    update: {
      status: 'ACTIVE',
      username: 'admin',
    },
  });
  console.log('✅ Using admin user:', adminUser.email);

  // Create or reuse Driver User (John)
  const driverPasswordHash = await bcrypt.hash('driver123', 10);
  const driverUser = await prisma.user.upsert({
    where: { email: 'john.driver@helsinkitaxi.fi' },
    create: {
      email: 'john.driver@helsinkitaxi.fi',
      username: 'johndriver',
      passwordHash: driverPasswordHash,
      status: 'ACTIVE',
    },
    update: {
      status: 'ACTIVE',
      username: 'johndriver',
    },
  });
  console.log('✅ Using driver user:', driverUser.email);

  // Create or reuse Driver User (Maria) - additional driver for Helsinki
  const driver2PasswordHash = await bcrypt.hash('driver456', 10);
  const driver2User = await prisma.user.upsert({
    where: { email: 'maria.driver@helsinkitaxi.fi' },
    create: {
      email: 'maria.driver@helsinkitaxi.fi',
      username: 'mariadriver',
      passwordHash: driver2PasswordHash,
      status: 'ACTIVE',
    },
    update: {
      status: 'ACTIVE',
      username: 'mariadriver',
    },
  });
  console.log('✅ Using driver user:', driver2User.email);

  // Create or reuse Admin Memberships (both tenants)
  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: adminUser.id,
        tenantId: helsinkiTenant.id,
      },
    },
    create: {
      userId: adminUser.id,
      tenantId: helsinkiTenant.id,
      role: 'ADMIN',
    },
    update: {
      role: 'ADMIN',
    },
  });
  console.log('✅ Ensured Helsinki admin membership');

  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: adminUser.id,
        tenantId: tampereTenant.id,
      },
    },
    create: {
      userId: adminUser.id,
      tenantId: tampereTenant.id,
      role: 'ADMIN',
    },
    update: {
      role: 'ADMIN',
    },
  });
  console.log('✅ Ensured Tampere admin membership');

  // Create or reuse Driver Profile for John (Helsinki)
  const driverProfile = await prisma.driverProfile.upsert({
    where: { userId: driverUser.id },
    create: {
      tenantId: helsinkiTenant.id,
      userId: driverUser.id,
      firstName: 'John',
      lastName: 'Virtanen',
      email: 'john.driver@helsinkitaxi.fi',
      phone: '+358401234567',
      status: 'ACTIVE',
    },
    update: {
      tenantId: helsinkiTenant.id,
      firstName: 'John',
      lastName: 'Virtanen',
      email: 'john.driver@helsinkitaxi.fi',
      phone: '+358401234567',
      status: 'ACTIVE',
    },
  });
  console.log(
    '✅ Created driver profile:',
    `${driverProfile.firstName} ${driverProfile.lastName}`,
  );

  // Create or reuse Driver Profile for Maria (Helsinki)
  const driver2Profile = await prisma.driverProfile.upsert({
    where: { userId: driver2User.id },
    create: {
      tenantId: helsinkiTenant.id,
      userId: driver2User.id,
      firstName: 'Maria',
      lastName: 'Korhonen',
      email: 'maria.driver@helsinkitaxi.fi',
      phone: '+358401234568',
      status: 'ACTIVE',
    },
    update: {
      tenantId: helsinkiTenant.id,
      firstName: 'Maria',
      lastName: 'Korhonen',
      email: 'maria.driver@helsinkitaxi.fi',
      phone: '+358401234568',
      status: 'ACTIVE',
    },
  });
  console.log(
    '✅ Created driver profile:',
    `${driver2Profile.firstName} ${driver2Profile.lastName}`,
  );

  // Create or reuse Driver Memberships (Helsinki)
  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: driverUser.id,
        tenantId: helsinkiTenant.id,
      },
    },
    create: {
      userId: driverUser.id,
      tenantId: helsinkiTenant.id,
      role: 'DRIVER',
    },
    update: {
      role: 'DRIVER',
    },
  });
  console.log('✅ Ensured driver membership (Helsinki): John');

  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: driver2User.id,
        tenantId: helsinkiTenant.id,
      },
    },
    create: {
      userId: driver2User.id,
      tenantId: helsinkiTenant.id,
      role: 'DRIVER',
    },
    update: {
      role: 'DRIVER',
    },
  });
  console.log('✅ Ensured driver membership (Helsinki): Maria');

  // Create or reuse First Pricing Policy (Standard - Helsinki)
  const standardPricing =
    (await prisma.pricingPolicy.findFirst({
      where: {
        tenantId: helsinkiTenant.id,
        name: 'Standard Pricing',
      },
    })) ??
    (await prisma.pricingPolicy.create({
      data: {
        tenantId: helsinkiTenant.id,
        name: 'Standard Pricing',
        baseFare: 3.5,
        perKm: 1.25,
        perMin: 0.35,
        isActive: true,
      },
    }));
  console.log('✅ Using pricing policy:', standardPricing.name);

  // Create or reuse Second Pricing Policy (Premium - Helsinki)
  const premiumPricing =
    (await prisma.pricingPolicy.findFirst({
      where: {
        tenantId: helsinkiTenant.id,
        name: 'Premium Pricing',
      },
    })) ??
    (await prisma.pricingPolicy.create({
      data: {
        tenantId: helsinkiTenant.id,
        name: 'Premium Pricing',
        baseFare: 5.0,
        perKm: 1.8,
        perMin: 0.5,
        isActive: false,
      },
    }));
  console.log('✅ Using pricing policy:', premiumPricing.name);

  // Create or reuse Tampere Pricing Policies
  const tamperStandardPricing =
    (await prisma.pricingPolicy.findFirst({
      where: {
        tenantId: tampereTenant.id,
        name: 'Tampere Standard',
      },
    })) ??
    (await prisma.pricingPolicy.create({
      data: {
        tenantId: tampereTenant.id,
        name: 'Tampere Standard',
        baseFare: 3.0,
        perKm: 1.15,
        perMin: 0.3,
        isActive: true,
      },
    }));
  console.log('✅ Using pricing policy:', tamperStandardPricing.name);

  // Create Fixed Price Policies (keep idempotent by reusing by name)
  const airportFixedPrice =
    (await prisma.fixedPricePolicy.findFirst({
      where: {
        tenantId: helsinkiTenant.id,
        driverProfileId: null,
        name: 'Airport Flat Rate',
      },
    })) ??
    (await prisma.fixedPricePolicy.create({
      data: {
        tenantId: helsinkiTenant.id,
        driverProfileId: null, // tenant-wide policy
        name: 'Airport Flat Rate',
        amount: 45.0,
        isActive: true,
        createdByUserId: adminUser.id,
      },
    }));
  console.log(
    '✅ Created fixed price policy:',
    airportFixedPrice.name,
    `€${airportFixedPrice.amount}`,
  );

  // Create a completed ride with Viva payment (skip if it already exists)
  const existingVivaPayment = await prisma.payment.findFirst({
    where: {
      tenantId: helsinkiTenant.id,
      externalPaymentId: 'viva_tx_1234567890',
    },
  });

  let sampleRide: any = undefined;
  let vivaPayment: any = undefined;

  if (existingVivaPayment) {
    vivaPayment = existingVivaPayment;
    sampleRide = await prisma.ride.findUnique({
      where: { id: existingVivaPayment.rideId },
    });
    console.log(
      '✅ Viva sample payment already exists, skipping ride/payment creation',
    );
  } else {
    const rideStartTime = new Date('2025-11-18T10:30:00Z');
    const rideEndTime = new Date('2025-11-18T10:48:00Z');

    sampleRide = await prisma.ride.create({
      data: {
        tenantId: helsinkiTenant.id,
        driverProfileId: driverProfile.id,
        pricingPolicyId: standardPricing.id,
        startedAt: rideStartTime,
        endedAt: rideEndTime,
        durationMin: 18.0, // 18 minutes
        distanceKm: 12.5, // 12.5 km
        fareSubtotal: 19.13, // baseFare (3.50) + perKm (1.25 * 12.5) + perMin (0.35 * 18)
        taxAmount: 4.59, // 24% tax
        fareTotal: 23.72, // subtotal + tax
        status: 'COMPLETED',
      },
    });
    console.log(
      '✅ Created sample ride:',
      `${sampleRide.distanceKm}km, €${sampleRide.fareTotal}`,
    );

    vivaPayment = await prisma.payment.create({
      data: {
        rideId: sampleRide.id,
        tenantId: helsinkiTenant.id,
        provider: 'VIVA',
        amount: sampleRide.fareTotal!,
        currency: 'EUR',
        status: 'PAID',
        authorizedAt: rideEndTime,
        capturedAt: new Date(rideEndTime.getTime() + 2 * 60 * 1000), // 2 minutes after ride end
        externalPaymentId: 'viva_tx_1234567890',
        approvalCode: 'APP123456',
        receiptNumber: '001',
        numberPeriod: '202511', // November 2025
      },
    });

    console.log(
      '✅ Created Viva payment:',
      `€${vivaPayment.amount}, Status: ${vivaPayment.status}`,
    );
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Summary:');
  console.log(
    `- Helsinki Tenant: ${helsinkiTenant.name} (ID: ${helsinkiTenant.id})`,
  );
  console.log(
    `- Tampere Tenant: ${tampereTenant.name} (ID: ${tampereTenant.id})`,
  );
  console.log(`- Admin User: ${adminUser.email} (Password: admin123)`);
  console.log(`- Driver User: ${driverUser.email} (Password: driver123)`);
  console.log(`- Driver User: ${driver2User.email} (Password: driver456)`);
  console.log(
    `- Driver Profile: ${driverProfile.firstName} ${driverProfile.lastName}`,
  );
  console.log(
    `- Driver Profile: ${driver2Profile.firstName} ${driver2Profile.lastName}`,
  );
  console.log(
    `- Helsinki Active: ${standardPricing.name} (€${standardPricing.baseFare} + €${standardPricing.perKm}/km)`,
  );
  console.log(
    `- Helsinki Inactive: ${premiumPricing.name} (€${premiumPricing.baseFare} + €${premiumPricing.perKm}/km)`,
  );
  console.log(
    `- Tampere Active: ${tamperStandardPricing.name} (€${tamperStandardPricing.baseFare} + €${tamperStandardPricing.perKm}/km)`,
  );
  console.log(`- Fixed Price Policies: 2 (1 tenant-wide, 1 personal)`);
  console.log(
    `  - Tenant-wide: ${airportFixedPrice.name} (€${airportFixedPrice.amount})`,
  );

  console.log(`- Memberships: 3 (admin in 2 tenants, driver in 1 tenant)`);
  if (sampleRide) {
    console.log(
      `- Sample Ride: ${sampleRide.distanceKm}km, ${sampleRide.durationMin}min, €${sampleRide.fareTotal}`,
    );
  }
  if (vivaPayment) {
    console.log(
      `- Viva Payment: €${vivaPayment.amount}, ${vivaPayment.status} (${vivaPayment.externalPaymentId})`,
    );
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
