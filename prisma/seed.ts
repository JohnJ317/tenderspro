import 'dotenv/config';
import { PrismaClient, Role, Grade, Country } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding...');

  await prisma.user.deleteMany();
  await prisma.cabinet.deleteMany();

  const cabinet = await prisma.cabinet.create({
    data: {
      name: 'International Audit & Conseil',
      country: Country.CI,
      currency: 'XOF',
      vatRate: 0.18,
      language: 'fr',
      status: 'ACTIVE',
    },
  });

  const passwordHash = await bcrypt.hash('Tender@2026', 8);

  await prisma.user.create({
    data: {
      cabinetId: cabinet.id,
      email: 'attobrajean31@gmail.com',
      passwordHash,
      firstName: 'Jean Jacques',
      lastName: 'ATTOBRA',
      role: Role.ADMIN_CABINET,
      grade: Grade.ASSOCIE,
    },
  });

  await prisma.user.create({
    data: {
      cabinetId: cabinet.id,
      email: 'jattobran@cabinet-iac.com',
      passwordHash,
      firstName: 'Jean',
      lastName: 'ATTOBRA',
      role: Role.MANAGER,
      grade: Grade.MANAGER,
    },
  });

  console.log('✅ Cabinet + 2 users créés');
  console.log('🔑 attobrajean31@gmail.com / Tender@2026');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });