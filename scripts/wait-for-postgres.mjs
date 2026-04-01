/**
 * Poll until TCP port 5432 accepts connections (Docker Postgres is ready).
 */
import net from 'node:net';

const host = process.env.POSTGRES_HOST ?? '127.0.0.1';
const port = Number(process.env.POSTGRES_PORT ?? 5432);
const timeoutMs = Number(process.env.POSTGRES_WAIT_MS ?? 60_000);
const intervalMs = 400;
const start = Date.now();

function tryOnce() {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => {
      socket.end();
      resolve();
    });
    socket.on('error', () => {
      socket.destroy();
      reject(new Error('not-ready'));
    });
  });
}

export async function waitForPostgres() {
  for (;;) {
    if (Date.now() - start > timeoutMs) {
      console.error(`Timeout waiting for PostgreSQL at ${host}:${port}`);
      process.exit(1);
    }
    try {
      await tryOnce();
      console.log(`PostgreSQL is up (${host}:${port}).`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}

