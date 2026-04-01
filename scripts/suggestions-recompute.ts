import 'dotenv/config';
import { prisma } from '@life-os/database';
import { recomputeSuggestionsForUser } from '../apps/api/src/services/suggestion-engine.ts';
import { ensureDefaultUser } from '../apps/api/src/lib/user.ts';

async function main() {
  const userId = await ensureDefaultUser();
  const { created } = await recomputeSuggestionsForUser(userId);
  console.log('Suggestions created:', created);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
