/**
 * Start Docker Compose Postgres, wait for the port, run Prisma migrate deploy.
 *
 * Forces DATABASE_URL to match docker-compose.yml so the CLI targets the Compose DB
 * (not another Postgres on localhost). See also `scripts/run-prisma.mjs` and
 * `scripts/normalize-database-url.mjs`.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { waitForPostgres } from './wait-for-postgres.mjs';

/** Must stay in sync with docker-compose.yml `postgres` service defaults. */
const COMPOSE_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/lifeos';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databaseRoot = join(root, 'packages', 'database');

const envPath = join(root, '.env');
const envExamplePath = join(root, '.env.example');
if (!existsSync(envPath) && existsSync(envExamplePath)) {
  copyFileSync(envExamplePath, envPath);
  console.log('Created .env from .env.example (Docker local defaults).');
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: root,
    env: process.env,
    ...opts,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function waitForPostgresInComposeContainer() {
  const deadline = Date.now() + 60_000;
  const intervalMs = 400;
  for (;;) {
    const r = spawnSync('docker', ['compose', 'exec', '-T', 'postgres', 'pg_isready', '-U', 'postgres', '-d', 'lifeos'], {
      cwd: root,
      stdio: 'ignore',
      env: process.env,
    });
    if (r.status === 0) {
      console.log('Postgres in container is ready.');
      return;
    }
    if (Date.now() > deadline) {
      console.error('Timeout waiting for Postgres inside the Docker container.');
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

run('docker', ['compose', 'up', '-d']);

await waitForPostgres();

await waitForPostgresInComposeContainer();

dotenv.config({ path: envPath });
process.env.DATABASE_URL = COMPOSE_DATABASE_URL;

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

const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  stdio: 'inherit',
  cwd: databaseRoot,
  env: process.env,
});
if (migrate.error) throw migrate.error;
if (migrate.status !== 0) process.exit(migrate.status ?? 1);
