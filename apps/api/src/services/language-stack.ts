import { prisma } from '@life-os/database';
import type { SupportedLanguage, UserLanguagePreference } from '@prisma/client';

export type CapabilitySummary = {
  languageTag: string;
  ui: boolean;
  typedAssistant: boolean;
  stt: boolean;
  tts: boolean;
  speechPipeline: boolean;
  qualityTier: string;
  rolloutState: string;
};

export async function listSupportedLanguages() {
  return prisma.supportedLanguage.findMany({
    orderBy: { languageTag: 'asc' },
    include: {
      providerPolicies: {
        select: { id: true, sttProvider: true, ttsProvider: true, offlineAllowed: true },
      },
    },
  });
}

export async function getSupportedLanguageByTag(languageTag: string) {
  return prisma.supportedLanguage.findUnique({
    where: { languageTag },
    include: { providerPolicies: true },
  });
}

export async function getOrCreateUserLanguagePreference(userId: string): Promise<UserLanguagePreference> {
  const existing = await prisma.userLanguagePreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.userLanguagePreference.create({
    data: {
      userId,
      primaryUiLanguage: 'en',
      primaryAssistantLanguage: 'en',
    },
  });
}

export async function updateUserLanguagePreference(
  userId: string,
  data: Partial<{
    primaryUiLanguage: string;
    primaryAssistantLanguage: string;
    preferredSttLanguage: string | null;
    preferredTtsLanguage: string | null;
    secondaryLanguagesJson: string;
    allowAutoLocaleSwitch: boolean;
  }>,
): Promise<UserLanguagePreference> {
  await getOrCreateUserLanguagePreference(userId);
  return prisma.userLanguagePreference.update({
    where: { userId },
    data,
  });
}

export function toCapabilitySummary(lang: SupportedLanguage): CapabilitySummary {
  return {
    languageTag: lang.languageTag,
    ui: lang.uiSupported,
    typedAssistant: lang.typedSupported,
    stt: lang.sttSupported,
    tts: lang.ttsSupported,
    speechPipeline: lang.s2sSupported,
    qualityTier: lang.qualityTier,
    rolloutState: lang.rolloutState,
  };
}

/** When voice is unavailable or user prefers text, surface this for clients. */
export function resolveInteractionFallback(
  lang: SupportedLanguage | null,
  modality: 'stt' | 'tts',
): { mode: 'voice' | 'text'; reason: string } {
  if (!lang) {
    return { mode: 'text', reason: 'unknown_language' };
  }
  if (modality === 'stt' && !lang.sttSupported) {
    return { mode: 'text', reason: 'stt_not_available_for_language' };
  }
  if (modality === 'tts' && !lang.ttsSupported) {
    return { mode: 'text', reason: 'tts_not_available_for_language' };
  }
  if (lang.rolloutState === 'disabled') {
    return { mode: 'text', reason: 'language_disabled' };
  }
  return { mode: 'voice', reason: 'ok' };
}

export type SttRoute = { languageTag: string; provider: string; offlineAllowed: boolean };
export type TtsRoute = { languageTag: string; provider: string; offlineAllowed: boolean };

export async function routeStt(languageTag: string): Promise<SttRoute | null> {
  const lang = await prisma.supportedLanguage.findUnique({
    where: { languageTag },
    include: { providerPolicies: true },
  });
  if (!lang || !lang.sttSupported) return null;
  const p = lang.providerPolicies[0];
  return {
    languageTag,
    provider: p?.sttProvider ?? 'stub',
    offlineAllowed: p?.offlineAllowed ?? false,
  };
}

export async function routeTts(languageTag: string): Promise<TtsRoute | null> {
  const lang = await prisma.supportedLanguage.findUnique({
    where: { languageTag },
    include: { providerPolicies: true },
  });
  if (!lang || !lang.ttsSupported) return null;
  const p = lang.providerPolicies[0];
  return {
    languageTag,
    provider: p?.ttsProvider ?? 'stub',
    offlineAllowed: p?.offlineAllowed ?? false,
  };
}

export function formatLocaleDateTime(isoOrDate: Date | string, languageTag: string, timeZone?: string): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat(languageTag, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(d);
}
