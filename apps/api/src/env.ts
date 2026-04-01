import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/** Monorepo root (…/apps/api/src → ../../../) so `pnpm dev` from apps/api finds repo `.env`. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(repoRoot, '.env') });

/** Align with `scripts/wait-for-postgres.mjs`: `localhost` → ::1 can hit a different PG than Docker on Windows. */
function normalizeDatabaseUrlHost(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname === 'localhost') {
      u.hostname = '127.0.0.1';
      return u.toString();
    }
  } catch {
    // leave unchanged
  }
  return url;
}
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeDatabaseUrlHost(process.env.DATABASE_URL);
}
