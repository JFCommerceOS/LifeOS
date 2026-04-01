/**
 * Load repo `.env`, normalize DATABASE_URL host, run Prisma CLI from `packages/database`.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { normalizeDatabaseUrlHost } from './normalize-database-url.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databaseRoot = join(root, 'packages', 'database');

dotenv.config({ path: join(root, '.env') });
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeDatabaseUrlHost(process.env.DATABASE_URL);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/run-prisma.mjs <prisma-args...>');
  process.exit(1);
}

const require = createRequire(join(databaseRoot, 'package.json'));
let prismaCli;
try {
  prismaCli = require.resolve('prisma/build/index.js');
} catch {
  console.error(
    'Could not resolve prisma CLI. Run `pnpm install` from the repo root, then try again.',
  );
  process.exit(1);
}

const r = spawnSync(process.execPath, [prismaCli, ...args], {
  stdio: 'inherit',
  cwd: databaseRoot,
  env: process.env,
});
process.exit(r.status ?? 1);
