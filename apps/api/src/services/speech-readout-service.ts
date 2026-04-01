import { prisma } from '@life-os/database';
import { startOfUtcDay } from '@life-os/shared';

export type ReadoutPayload = {
  enabled: boolean;
  text: string;
  /** Stub until TTS is wired; null means client would use Web Speech API or native. */
  audioBase64: null;
  note?: string;
};

export async function buildDailyBriefReadout(userId: string): Promise<ReadoutPayload> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.spokenReadoutEnabled) {
    return {
      enabled: false,
      text: '',
      audioBase64: null,
      note: 'Spoken readout is off in settings.',
    };
  }

  const day = startOfUtcDay(new Date());
  const brief = await prisma.dailyBrief.findFirst({
    where: { userId, day },
    include: { items: { orderBy: { sortOrder: 'asc' }, take: 12 } },
  });

  if (!brief?.items.length) {
    return {
      enabled: true,
      text: 'Nothing on your brief for today.',
      audioBase64: null,
      note: 'TTS stub — no audio returned yet.',
    };
  }

  const lines = brief.items.map((i) => i.title);
  return {
    enabled: true,
    text: `Here's your brief. ${lines.join('. ')}`,
    audioBase64: null,
    note: 'TTS stub — no audio returned yet.',
  };
}

export async function buildSuggestionReadout(userId: string, suggestionId: string): Promise<ReadoutPayload> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.spokenReadoutEnabled) {
    return {
      enabled: false,
      text: '',
      audioBase64: null,
      note: 'Spoken readout is off in settings.',
    };
  }

  const s = await prisma.suggestion.findFirst({ where: { id: suggestionId, userId } });
  if (!s) {
    return {
      enabled: true,
      text: '',
      audioBase64: null,
      note: 'Suggestion not found.',
    };
  }

  return {
    enabled: true,
    text: `${s.title}. ${s.reason}`,
    audioBase64: null,
    note: 'TTS stub — no audio returned yet.',
  };
}
