import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const hashed = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { phone_role: { phone: '+221700000000', role: 'admin' } },
    update: {},
    create: {
      firstName: 'Admin',
      lastName: 'Bagup',
      phone: '+221700000000',
      password: hashed,
      role: 'admin',
      isActive: true,
      isVerified: true,
    },
  });

  console.log('Admin created:', { id: admin.id, phone: admin.phone, role: admin.role });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
