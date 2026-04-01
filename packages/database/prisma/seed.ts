import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = 'demo@lifeos.local';
  const user = await prisma.user.upsert({
    where: { email },
    create: { email },
    update: {},
  });

  console.log(`[seed] demo user id=${user.id} email=${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
