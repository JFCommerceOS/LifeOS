import { prisma } from '@life-os/database';
import { placeEventExcludedFromPatternInsights } from './sensitive-place-guard.js';

export type ExplicitTraitRow = {
  key: string;
  label: string;
  value: string;
  source: 'profile' | 'settings';
};

export type InferredTraitRow = {
  key: string;
  label: string;
  summary: string;
  confidence: number;
  evidence: string[];
  userNote?: string;
  userOverrideSummary?: string;
  hiddenByUser: boolean;
};

export type DigitalTwinPayload = {
  predictiveMode: boolean;
  disclaimer: string;
  explicit: ExplicitTraitRow[];
  inferred: InferredTraitRow[];
};

const DISCLAIMER =
  'Inferences are derived from data you already store in Life OS. They are fallible — correct or disable them anytime.';

type CorrectionEntry = { note?: string; overrideSummary?: string };

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Inspectable twin view: explicit preferences vs lightweight inferred traits. */
export async function buildDigitalTwin(userId: string): Promise<DigitalTwinPayload> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const predictiveMode = settings?.predictiveModeOptIn ?? false;

  const twinRow = await prisma.digitalTwinProfile.findUnique({ where: { userId } });
  const corrections = safeParseJson<Record<string, CorrectionEntry>>(
    twinRow?.correctionsJson ?? '{}',
    {},
  );
  const disabledKeys = new Set(
    safeParseJson<string[]>(twinRow?.disabledInferenceKeysJson ?? '[]', []),
  );

  const [profile, openObs, stWeek, placeRecent, decisionCount] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.obligation.count({ where: { userId, status: 'open' } }),
    prisma.screenTimeSummary.findMany({
      where: { userId },
      orderBy: { day: 'desc' },
      take: 14,
    }),
    prisma.placeEvent.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
      take: 25,
      include: { savedPlace: true },
    }),
    prisma.decisionRecord.count({ where: { userId } }),
  ]);

  const placeRecentVisible = placeRecent.filter(
    (p) =>
      !placeEventExcludedFromPatternInsights({
        masked: p.masked,
        savedPlace: p.savedPlace
          ? { sensitivity: p.savedPlace.sensitivity, defaultMasked: p.savedPlace.defaultMasked }
          : null,
      }),
  );

  const explicit: ExplicitTraitRow[] = [];
  if (profile) {
    explicit.push(
      { key: 'profile_type', label: 'Profile type', value: profile.profileType, source: 'profile' },
      {
        key: 'reminder_timing',
        label: 'Reminder timing preference',
        value: profile.reminderTiming,
        source: 'profile',
      },
      { key: 'nudge_style', label: 'Nudge style', value: profile.nudgeStyle, source: 'profile' },
      {
        key: 'notification_density',
        label: 'Notification density',
        value: profile.notificationDensity,
        source: 'profile',
      },
    );
  }
  explicit.push({
    key: 'pattern_signals',
    label: 'Pattern signals',
    value: settings?.patternSignalsOptIn ? 'opted in' : 'off',
    source: 'settings',
  });
  explicit.push({
    key: 'lifestyle_insights',
    label: 'Lifestyle insights',
    value: settings?.lifestyleInsightsOptIn ? 'opted in' : 'off',
    source: 'settings',
  });

  const inferred: InferredTraitRow[] = [];

  const lateAvg =
    stWeek.length > 0 ? stWeek.reduce((a, s) => a + s.lateNightMinutes, 0) / stWeek.length : 0;
  inferred.push({
    key: 'rhythm_screen',
    label: 'Evening screen rhythm',
    summary:
      lateAvg > 50
        ? 'Late-evening screen time has often been elevated in recent summaries.'
        : stWeek.length >= 3
          ? 'Recent screen-time totals look relatively moderate in recorded days.'
          : 'Not enough screen-time summaries yet for a rhythm read.',
    confidence: stWeek.length >= 5 ? 0.72 : stWeek.length >= 2 ? 0.45 : 0.2,
    evidence:
      stWeek.length > 0
        ? [`${stWeek.length} day(s) of screen-time summaries in the window.`]
        : ['No screen-time summaries yet.'],
    hiddenByUser: disabledKeys.has('rhythm_screen'),
  });

  const uniquePlaces = new Set(placeRecentVisible.map((p) => p.placeLabel));
  inferred.push({
    key: 'place_variety',
    label: 'Place variety (labels)',
    summary:
      uniquePlaces.size >= 5
        ? 'Several distinct place labels recently — routines may be varied.'
        : uniquePlaces.size > 0
          ? 'A smaller set of place labels recently — some stability in where time goes.'
          : 'No recent place labels — add generalized visits on Patterns if you want this signal.',
    confidence: placeRecentVisible.length >= 8 ? 0.65 : placeRecentVisible.length >= 3 ? 0.4 : 0.15,
    evidence: [
      `${placeRecentVisible.length} recent place row(s), ${uniquePlaces.size} distinct label(s) (sensitive visits excluded).`,
    ],
    hiddenByUser: disabledKeys.has('place_variety'),
  });

  inferred.push({
    key: 'workload_load',
    label: 'Open follow-up load',
    summary:
      openObs >= 10
        ? 'Open follow-ups are high — capacity may be tight.'
        : openObs >= 5
          ? 'A moderate stack of open follow-ups.'
          : 'Follow-up load looks light right now.',
    confidence: 0.7,
    evidence: [`${openObs} open obligation(s).`],
    hiddenByUser: disabledKeys.has('workload_load'),
  });

  inferred.push({
    key: 'decision_memory',
    label: 'Decision ledger use',
    summary:
      decisionCount >= 5
        ? 'You have several logged decisions — good continuity for “similar choice” recall.'
        : decisionCount > 0
          ? 'Some decisions logged; more entries strengthen recall.'
          : 'No decisions logged yet — Life flow can store rationale and outcomes.',
    confidence: decisionCount >= 3 ? 0.6 : 0.35,
    evidence: [`${decisionCount} decision record(s).`],
    hiddenByUser: disabledKeys.has('decision_memory'),
  });

  for (const row of inferred) {
    const c = corrections[row.key];
    if (c?.note) row.userNote = c.note;
    if (c?.overrideSummary) row.userOverrideSummary = c.overrideSummary;
    if (c?.overrideSummary) row.summary = c.overrideSummary;
  }

  return {
    predictiveMode,
    disclaimer: DISCLAIMER,
    explicit,
    inferred,
  };
}

