import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create First Tenant (Helsinki)
  const helsinkiTenant = await prisma.tenant.create({
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
  });
  console.log('✅ Created tenant:', helsinkiTenant.name);

  // Create Second Tenant (Tampere)
  const tampereTenant = await prisma.tenant.create({
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
  });
  console.log('✅ Created tenant:', tampereTenant.name);

  // Create Admin User
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@helsinkitaxi.fi',
      username: 'admin',
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
    },
  });
  console.log('✅ Created admin user:', adminUser.email);

  // Create Driver User
  const driverPasswordHash = await bcrypt.hash('driver123', 10);
  const driverUser = await prisma.user.create({
    data: {
      email: 'john.driver@helsinkitaxi.fi',
      username: 'johndriver',
      passwordHash: driverPasswordHash,
      status: 'ACTIVE',
    },
  });
  console.log('✅ Created driver user:', driverUser.email);

  // Create Admin Memberships (both tenants)
  const helsinkiAdminMembership = await prisma.membership.create({
    data: {
      userId: adminUser.id,
      tenantId: helsinkiTenant.id,
      role: 'ADMIN',
    },
  });
  console.log('✅ Created Helsinki admin membership');

  const tampereAdminMembership = await prisma.membership.create({
    data: {
      userId: adminUser.id,
      tenantId: tampereTenant.id,
      role: 'ADMIN',
    },
  });
  console.log('✅ Created Tampere admin membership');

  // Create Driver Profile for the driver user (Helsinki)
  const driverProfile = await prisma.driverProfile.create({
    data: {
      tenantId: helsinkiTenant.id,
      userId: driverUser.id,
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

  // Create Driver Membership (Helsinki)
  const driverMembership = await prisma.membership.create({
    data: {
      userId: driverUser.id,
      tenantId: helsinkiTenant.id,
      role: 'DRIVER',
    },
  });
  console.log('✅ Created driver membership (Helsinki)');

  // Create First Pricing Policy (Standard - Helsinki)
  const standardPricing = await prisma.pricingPolicy.create({
    data: {
      tenantId: helsinkiTenant.id,
      name: 'Standard Pricing',
      baseFare: 3.5,
      perKm: 1.25,
      perMin: 0.35,
      isActive: true,
    },
  });
  console.log('✅ Created pricing policy:', standardPricing.name);

  // Create Second Pricing Policy (Premium - Helsinki)
  const premiumPricing = await prisma.pricingPolicy.create({
    data: {
      tenantId: helsinkiTenant.id,
      name: 'Premium Pricing',
      baseFare: 5.0,
      perKm: 1.8,
      perMin: 0.5,
      isActive: false,
    },
  });
  console.log('✅ Created pricing policy:', premiumPricing.name);

  // Create Tampere Pricing Policies
  const tamperStandardPricing = await prisma.pricingPolicy.create({
    data: {
      tenantId: tampereTenant.id,
      name: 'Tampere Standard',
      baseFare: 3.0,
      perKm: 1.15,
      perMin: 0.3,
      isActive: true,
    },
  });
  console.log('✅ Created pricing policy:', tamperStandardPricing.name);

  // Create a completed ride with Viva payment
  const rideStartTime = new Date('2025-11-18T10:30:00Z');
  const rideEndTime = new Date('2025-11-18T10:48:00Z');

  const sampleRide = await prisma.ride.create({
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

  // Create Viva payment for the ride
  const vivaPayment = await prisma.payment.create({
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
  console.log(
    `- Driver Profile: ${driverProfile.firstName} ${driverProfile.lastName}`,
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
  console.log(`- Memberships: 3 (admin in 2 tenants, driver in 1 tenant)`);
  console.log(
    `- Sample Ride: ${sampleRide.distanceKm}km, ${sampleRide.durationMin}min, €${sampleRide.fareTotal}`,
  );
  console.log(
    `- Viva Payment: €${vivaPayment.amount}, ${vivaPayment.status} (${vivaPayment.externalPaymentId})`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
