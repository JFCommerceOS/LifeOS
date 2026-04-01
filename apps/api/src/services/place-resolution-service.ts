import { prisma } from '@life-os/database';

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolve free-text label to a saved place for this user (label match or alias match).
 */
export async function resolveSavedPlaceIdFromLabel(userId: string, label: string): Promise<string | null> {
  const key = norm(label);
  if (!key.length) return null;

  const owned = await prisma.savedPlace.findMany({
    where: { userId },
    select: { id: true, label: true },
  });
  for (const p of owned) {
    if (norm(p.label) === key) return p.id;
  }

  const viaAlias = await prisma.placeAlias.findFirst({
    where: { alias: key, savedPlace: { userId } },
    select: { savedPlaceId: true },
  });
  return viaAlias?.savedPlaceId ?? null;
}
