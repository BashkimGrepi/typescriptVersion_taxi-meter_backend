import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createDriverUser() {
  const passwordHash = await bcrypt.hash('DriverPass123!', 10);
  
  // Create or find a tenant first
  let tenant = await (prisma as any).tenant.findFirst({
    where: { businessId: '9876543-2' }
  });

  if (!tenant) {
    tenant = await (prisma as any).tenant.create({
      data: {
        name: 'Demo Taxi Company',
        businessId: '9876543-2'
      }
    });
  }

  // Create driver user
  let driverUser = await (prisma as any).user.findUnique({
    where: { email: 'driver@demo.com' }
  });

  if (!driverUser) {
    driverUser = await (prisma as any).user.create({
      data: {
        email: 'driver@demo.com',
        passwordHash: passwordHash,
        username: 'driver_demo',
        status: 'ACTIVE'
      }
    });
  }

  // Create membership with DRIVER role
  let membership = await (prisma as any).membership.findFirst({
    where: {
      userId: driverUser.id,
      tenantId: tenant.id
    }
  });

  if (!membership) {
    membership = await (prisma as any).membership.create({
      data: {
        userId: driverUser.id,
        tenantId: tenant.id,
        role: 'DRIVER'
      }
    });
  }

  // Create driver profile
  let driverProfile = await (prisma as any).driverProfile.findFirst({
    where: { userId: driverUser.id }
  });

  if (!driverProfile) {
    driverProfile = await (prisma as any).driverProfile.create({
      data: {
        tenantId: tenant.id,
        userId: driverUser.id,
        firstName: 'John',
        lastName: 'Driver',
        phone: '+358401234567',
        status: 'ACTIVE'
      }
    });
  }

  console.log('✅ Driver user created:');
  console.log('Email: driver@demo.com');
  console.log('Password: DriverPass123!');
  console.log('Role: DRIVER');
  console.log('Status: ACTIVE');
}

createDriverUser()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
