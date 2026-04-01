import 'dotenv/config';
import { prisma } from '@life-os/database';
import { generateDailyBriefForUser } from '../apps/api/src/services/brief-engine.ts';
import { ensureDefaultUser } from '../apps/api/src/lib/user.ts';

async function main() {
  const userId = await ensureDefaultUser();
  const { briefId } = await generateDailyBriefForUser(userId);
  console.log('Daily brief:', briefId);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
