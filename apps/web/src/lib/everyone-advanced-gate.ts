/** Advanced surfaces shown in full nav; in Everyone Mode we show a soft education gate first (per-area, session-dismissible). */

export type EveryoneGateKind =
  | 'people'
  | 'timeline'
  | 'admin'
  | 'meProfile'
  | 'profileTools'
  | 'patterns'
  | 'lifeFlow'
  | 'copilot'
  | 'ecosystem'
  | 'tile'
  | 'capabilities'
  | 'domains'
  | 'memory'
  | 'documents'
  | 'connectors';

const STORAGE_PREFIX = 'lifeosEveryoneGate:';

export function everyoneGateStorageKey(kind: EveryoneGateKind): string {
  return `${STORAGE_PREFIX}${kind}`;
}

export function everyoneAdvancedGateKind(pathname: string): EveryoneGateKind | null {
  const p = (pathname.split('?')[0] ?? pathname).replace(/\/$/, '') || '/';

  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/connectors')) return 'connectors';
  if (p.startsWith('/documents')) return 'documents';
  if (p.startsWith('/memory')) return 'memory';
  if (p.startsWith('/domains')) return 'domains';
  if (p.startsWith('/capabilities')) return 'capabilities';
  if (p.startsWith('/tile')) return 'tile';
  if (p.startsWith('/ecosystem')) return 'ecosystem';
  if (p.startsWith('/twin')) return 'copilot';
  if (p.startsWith('/life')) return 'lifeFlow';
  if (p.startsWith('/patterns')) return 'patterns';
  if (p.startsWith('/profile/')) return 'profileTools';
  if (p === '/me') return 'meProfile';
  if (p.startsWith('/people')) return 'people';
  if (p.startsWith('/events')) return 'timeline';

  return null;
}

export function daysSinceIso(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 86_400_000;
}
