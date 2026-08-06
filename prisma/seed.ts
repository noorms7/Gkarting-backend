import { PrismaClient, Role, WeekDay } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@gkarting.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  // ---------------- Admin account ----------------
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      firstName: 'GKarting',
      lastName: 'Admin',
      email: adminEmail,
      phone: '+96100000000',
      passwordHash,
      role: Role.ADMIN,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Admin account ready: ${adminEmail}`);

  // ---------------- Kart fleet ----------------
  const kartCount = await prisma.kart.count();
  if (kartCount === 0) {
    await prisma.kart.createMany({
      data: Array.from({ length: 12 }).map((_, i) => ({
        code: `K-${String(i + 1).padStart(2, '0')}`,
        name: `Racing Kart ${i + 1}`,
      })),
    });
    console.log('Seeded 12 karts');
  }

  // ---------------- Pricing packages ----------------
  const pricingCount = await prisma.pricingPackage.count();
  if (pricingCount === 0) {
    await prisma.pricingPackage.createMany({
      data: [
        {
          name: '15 Minutes',
          durationMins: 15,
          basePrice: 18,
          maxKarts: 1,
          sortOrder: 1,
          description: '8-10 laps average — great for first-timers.',
        },
        {
          name: '30 Minutes',
          durationMins: 30,
          basePrice: 30,
          maxKarts: 1,
          sortOrder: 2,
          description: '16-20 laps average — the most popular length.',
        },
        {
          name: '45 Minutes',
          durationMins: 45,
          basePrice: 42,
          maxKarts: 1,
          sortOrder: 3,
          description: '24-30 laps average — priority grid position.',
        },
        {
          name: '1 Hour',
          durationMins: 60,
          basePrice: 55,
          maxKarts: 1,
          sortOrder: 4,
          description: 'Two staggered sessions with a rest break.',
        },
        {
          name: 'Group Package',
          durationMins: 30,
          basePrice: 150,
          maxKarts: 5,
          isGroup: true,
          sortOrder: 5,
          description: 'Private grid slot for up to 5 racers.',
        },
        {
          name: 'VIP Package',
          durationMins: 45,
          basePrice: 95,
          maxKarts: 1,
          sortOrder: 6,
          description: 'Reserved fastest kart, private briefing, data review.',
        },
      ],
    });
    console.log('Seeded pricing packages');
  }

  // ---------------- Business hours ----------------
  const hoursCount = await prisma.businessHour.count();
  if (hoursCount === 0) {
    const days = Object.values(WeekDay);
    await prisma.businessHour.createMany({
      data: days.map((day) => ({
        day,
        isOpen: true,
        openTime: '10:00',
        closeTime: '22:00',
      })),
    });
    console.log('Seeded business hours (10:00-22:00 daily)');
  }

  // ---------------- Track status (singleton) ----------------
  const statusCount = await prisma.trackStatus.count();
  if (statusCount === 0) {
    await prisma.trackStatus.create({
      data: { operationalStatus: 'OPEN' },
    });
    console.log('Seeded track status singleton');
  }

  // ---------------- Site settings (singleton) ----------------
  const settingsCount = await prisma.siteSettings.count();
  if (settingsCount === 0) {
    await prisma.siteSettings.create({
      data: {
        businessName: 'GKarting',
        phone: '+961 00 000 000',
        email: 'nrwork.mob@gmail.com',
        whatsapp: 'https://wa.me/96100000000',
        instagramUrl: 'https://instagram.com/nour_moussawi',
        facebookUrl: 'https://facebook.com/',
        latitude: 34.4361,
        longitude: 35.8497,
      },
    });
    console.log('Seeded site settings');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
