import { prisma } from '@life-os/database';
import type { UserStateType } from '@prisma/client';

/** Heuristic user-state signal for mediation (no ML; explainable). */
export async function computeUserState(userId: string): Promise<{
  stateType: UserStateType;
  confidence: number;
  sourceSummary: string;
}> {
  const [openObligations, pendingSuggestions, profile] = await Promise.all([
    prisma.obligation.count({ where: { userId, status: 'open' } }),
    prisma.suggestion.count({ where: { userId, state: 'pending' } }),
    prisma.userProfile.findUnique({ where: { userId } }),
  ]);

  const load = openObligations + pendingSuggestions * 0.45;
  let stateType: UserStateType = 'focused';
  let confidence = 0.42;
  let sourceSummary = `Open obligations ${openObligations}, pending suggestions ${pendingSuggestions}`;

  if (load > 28) {
    stateType = 'overloaded';
    confidence = 0.68;
  } else if (load > 16) {
    stateType = 'fragmented';
    confidence = 0.58;
  } else if (pendingSuggestions > 12 && openObligations < 4) {
    stateType = 'low_attention';
    confidence = 0.52;
    sourceSummary += '; many suggestions, few obligations';
  }

  if (profile?.nudgeStyle === 'gentle' && stateType === 'overloaded') {
    stateType = 'fragmented';
    sourceSummary += '; gentle profile softens overload label';
  }

  return { stateType, confidence, sourceSummary };
}

export async function persistUserStateSnapshot(userId: string) {
  const { stateType, confidence, sourceSummary } = await computeUserState(userId);
  const expiresAt = new Date(Date.now() + 4 * 3600000);
  return prisma.userStateSnapshot.create({
    data: { userId, stateType, confidence, sourceSummary, expiresAt },
  });
}

export async function getLatestUserState(userId: string) {
  return prisma.userStateSnapshot.findFirst({
    where: { userId },
    orderBy: { detectedAt: 'desc' },
  });
}
