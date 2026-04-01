import { prisma } from '@life-os/database';
import { ensureUserDomainProfiles } from './adaptive-domain-service.js';

export type ToneHints = {
  complexity: 'minimal' | 'simple' | 'normal' | 'compressed';
  pace: 'slow' | 'steady' | 'direct';
  warmth: 'neutral' | 'higher';
  avoidPhrases: string[];
};

const DEFAULT_TONE: ToneHints = {
  complexity: 'normal',
  pace: 'steady',
  warmth: 'neutral',
  avoidPhrases: [],
};

/** Merge tone profiles from AssistantDomain.toneProfile for active domains. */
export async function getToneHintsForUser(userId: string): Promise<ToneHints> {
  await ensureUserDomainProfiles(userId);
  const catalog = await prisma.assistantDomain.findMany();
  const profiles = await prisma.userDomainProfile.findMany({
    where: { userId, runtimeState: { in: ['active', 'passive'] } },
  });
  const activeKeys = new Set(
    profiles.filter((p) => p.runtimeState === 'active').map((p) => p.domainKey),
  );
  const merged: ToneHints = { ...DEFAULT_TONE };

  for (const c of catalog) {
    if (!activeKeys.has(c.domainKey)) continue;
    try {
      const p = JSON.parse(c.toneProfile || '{}') as Partial<ToneHints>;
      if (p.complexity === 'simple' || p.complexity === 'minimal') merged.complexity = p.complexity;
      if (p.pace === 'slow') merged.pace = 'slow';
      if (p.pace === 'direct') merged.pace = 'direct';
      if (p.warmth === 'higher') merged.warmth = 'higher';
    } catch {
      /* ignore */
    }
  }

  merged.avoidPhrases = [
    'teacher mode',
    'doctor mode',
    'therapist',
    'certified tutor',
    'diagnosis',
  ];

  return merged;
}

/** Optional suffix localized in web as `mediation.<toneKey>`. */
export type MediationToneKey = 'domainToneMinimal' | 'domainToneCompact' | 'domainToneSlow';

export type DomainToneAppendResult = {
  text: string;
  toneKey: MediationToneKey | null;
};

/** Deterministic suffix for mediation logs — never calls an LLM. */
export async function appendDomainToneToReasonSummary(
  base: string,
  userId: string,
): Promise<DomainToneAppendResult> {
  const hints = await getToneHintsForUser(userId);
  if (hints.complexity === 'minimal' || hints.complexity === 'simple') {
    return {
      text: `${base} · Domain tone: simpler phrasing`,
      toneKey: 'domainToneMinimal',
    };
  }
  if (hints.complexity === 'compressed') {
    return {
      text: `${base} · Domain tone: compact`,
      toneKey: 'domainToneCompact',
    };
  }
  if (hints.pace === 'slow') {
    return {
      text: `${base} · Domain tone: slower pacing`,
      toneKey: 'domainToneSlow',
    };
  }
  return { text: base, toneKey: null };
}
