/**
 * Upsert des comptes staff back-office.
 * Usage:
 *   STAFF_ASSISTANT_PASSWORD='...' STAFF_MANAGER_PASSWORD='...' STAFF_ADMIN_PASSWORD='...' \
 *   npx ts-node -r dotenv/config scripts/upsert-staff.ts
 *
 * Ne pas committer les mots de passe. Variables d’env requises pour chaque compte à créer/MAJ.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

type StaffSpec = {
  role: 'admin' | 'assistant' | 'manager';
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  passwordEnv: string;
};

const STAFF: StaffSpec[] = [
  {
    role: 'assistant',
    email: 'contact@bagup-services.com',
    phone: '+221789584444',
    firstName: 'Assistante',
    lastName: "Bag'up",
    passwordEnv: 'STAFF_ASSISTANT_PASSWORD',
  },
  {
    role: 'manager',
    email: 'moustaphacisse@bagup-services.com',
    phone: '+221789584445',
    firstName: 'Moustapha',
    lastName: 'Cissé',
    passwordEnv: 'STAFF_MANAGER_PASSWORD',
  },
  {
    role: 'admin',
    email: 'amsatoucisse@bagup-services.com',
    phone: '+221789584446',
    firstName: 'Amsatou',
    lastName: 'Cissé',
    passwordEnv: 'STAFF_ADMIN_PASSWORD',
  },
];

async function upsertOne(spec: StaffSpec) {
  const password = process.env[spec.passwordEnv]?.trim();
  const existing =
    (await prisma.user.findFirst({ where: { email: spec.email, role: spec.role } })) ||
    (await prisma.user.findFirst({ where: { email: spec.email } })) ||
    (await prisma.user.findUnique({ where: { phone_role: { phone: spec.phone, role: spec.role } } }));

  if (!password && !existing) {
    console.log(`SKIP ${spec.role} (${spec.email}) — ${spec.passwordEnv} non défini et compte inexistant`);
    return;
  }

  const data: any = {
    email: spec.email,
    phone: existing?.phone || spec.phone,
    firstName: spec.firstName,
    lastName: spec.lastName,
    role: spec.role,
    isActive: true,
    isVerified: true,
    phoneVerified: true,
  };
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  if (existing) {
    // Si l'email existe déjà sous un autre rôle, on force le rôle staff demandé
    await prisma.user.update({
      where: { id: existing.id },
      data,
    });
    console.log(`UPDATED ${spec.role} ${spec.email}${password ? ' (+mdp)' : ''}`);
    return;
  }

  await prisma.user.create({
    data: {
      ...data,
      phone: spec.phone,
      password: data.password,
    },
  });
  console.log(`CREATED ${spec.role} ${spec.email}`);
}

async function main() {
  for (const spec of STAFF) {
    await upsertOne(spec);
  }

  // Rattacher l’email admin sur un éventuel seed historique (+221700000000)
  const legacy = await prisma.user.findFirst({
    where: { phone: '+221700000000', role: 'admin' },
  });
  if (legacy && !legacy.email) {
    await prisma.user.update({
      where: { id: legacy.id },
      data: { email: 'amsatoucisse@bagup-services.com' },
    });
    console.log('LINKED legacy admin +221700000000 → amsatoucisse@bagup-services.com');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
