import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const user = await (prisma as any).user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { 
      email: 'admin@example.com', 
      passwordHash: passwordHash, 
      username: 'admin',
      status: 'ACTIVE'
    },
  });
  console.log('Seeded user:', user.email);
}

main().finally(() => prisma.$disconnect());
