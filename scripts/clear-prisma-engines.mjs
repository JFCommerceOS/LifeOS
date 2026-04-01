/**
 * Windows often locks `query_engine-windows.dll.node` during `prisma generate`,
 * causing EPERM on rename. Removing stale `.prisma` output dirs first usually fixes it.
 *
 * If removal still gets EPERM: stop ALL Node processes (dev servers, other terminals),
 * then retry. Last resort: Windows Security → exclude `D:\LifeOS\node_modules`, or
 * delete `node_modules` and run `pnpm install` (after `.npmrc` hoisting for Prisma).
 */
import { existsSync, readdirSync } from 'fs';
import { rm } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

async function rmWithRetry(p, tries = 10) {
  if (!existsSync(p)) return true;
  for (let i = 0; i < tries; i++) {
    try {
      await rm(p, { recursive: true, force: true });
      console.log('[clear-prisma-engines] removed', p);
      return true;
    } catch (e) {
      const msg = e?.code === 'EPERM' || e?.code === 'EBUSY' ? 'will retry' : 'give up';
      console.warn(`[clear-prisma-engines] attempt ${i + 1}/${tries} ${msg}:`, p, e?.message ?? e);
      await new Promise((r) => setTimeout(r, 350 * (i + 1)));
    }
  }
  return false;
}

/** pnpm: node_modules/.pnpm/@prisma+client@<ver>/node_modules/.prisma */
async function clearPnpmPrismaClient() {
  const pnpmDir = join(repoRoot, 'node_modules', '.pnpm');
  if (!existsSync(pnpmDir)) return;
  for (const name of readdirSync(pnpmDir, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    if (!name.name.startsWith('@prisma+client@') && !name.name.startsWith('prisma@')) continue;
    await rmWithRetry(join(pnpmDir, name.name, 'node_modules', '.prisma'));
  }
}

await rmWithRetry(join(repoRoot, 'node_modules', '.prisma'));
await clearPnpmPrismaClient();
