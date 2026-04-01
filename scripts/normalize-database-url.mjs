/**
 * Map `localhost` → `127.0.0.1` in DATABASE_URL so CLI and TCP checks hit the same
 * Postgres as Docker’s IPv4 publish (Windows often resolves `localhost` to ::1).
 */
export function normalizeDatabaseUrlHost(urlString) {
  if (!urlString || typeof urlString !== 'string') return urlString;
  try {
    const u = new URL(urlString);
    if (u.hostname === 'localhost') {
      u.hostname = '127.0.0.1';
      return u.toString();
    }
  } catch {
    // leave unchanged
  }
  return urlString;
}
