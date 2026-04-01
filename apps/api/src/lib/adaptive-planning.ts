import { prisma } from '@life-os/database';

export type AdaptiveCard = {
  id: string;
  title: string;
  rationale: string;
  confidence: number;
  influencingFactors: string[];
  timingNote: string;
};

export type AdaptivePlanningPayload = {
  enabled: boolean;
  disclaimer: string;
  cards: AdaptiveCard[];
};

const DISCLAIMER =
  'Suggestions are reversible and based on structured data you already keep. Nothing reschedules automatically.';

/** Explainable planning cards — only when predictive mode is on. */
export async function buildAdaptivePlanning(userId: string): Promise<AdaptivePlanningPayload> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.predictiveModeOptIn) {
    return {
      enabled: false,
      disclaimer: DISCLAIMER,
      cards: [
        {
          id: 'predictive_off',
          title: 'Predictive mode is off',
          rationale: 'Enable predictive co-pilot in Settings to see timing-aware planning cards here.',
          confidence: 1,
          influencingFactors: ['user_settings'],
          timingNote: 'N/A',
        },
      ],
    };
  }

  const [profile, openObs, st, nextAppt] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.obligation.findMany({
      where: { userId, status: 'open' },
      orderBy: [{ dueAt: 'asc' }],
      take: 12,
      select: { id: true, title: true, dueAt: true },
    }),
    prisma.screenTimeSummary.findMany({
      where: { userId },
      orderBy: { day: 'desc' },
      take: 7,
    }),
    prisma.lifeAppointment.findFirst({
      where: { userId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
    }),
  ]);

  const cards: AdaptiveCard[] = [];
  const late = st.reduce((a, s) => a + s.lateNightMinutes, 0);
  const rt = profile?.reminderTiming ?? 'balanced';

  if (openObs.length >= 8) {
    cards.push({
      id: 'capacity_trim',
      title: 'Consider trimming or sequencing follow-ups',
      rationale:
        'Several open obligations compete for attention; sequencing reduces thrash without dropping commitments.',
      confidence: 0.78,
      influencingFactors: ['obligation_backlog', 'ranked_due_dates'],
      timingNote:
        rt === 'morning'
          ? 'A short morning pass may clear the top 2–3 items before new work arrives.'
          : 'A mid-day review window may work better than late evening when load is high.',
    });
  }

  if (late > 200 && st.length >= 4) {
    cards.push({
      id: 'evening_guard',
      title: 'Protect earlier focus blocks',
      rationale:
        'Late-night screen totals suggest evenings are busy; heavier tasks may land better earlier in the day.',
      confidence: 0.62,
      influencingFactors: ['screen_time_summaries'],
      timingNote: 'Try scheduling dense admin before dinner when possible.',
    });
  }

  if (nextAppt) {
    cards.push({
      id: 'appointment_buffer',
      title: `Buffer before “${nextAppt.title.slice(0, 40)}${nextAppt.title.length > 40 ? '…' : ''}”`,
      rationale:
        'Upcoming life-admin appointment — a short prep block reduces last-minute scrambling.',
      confidence: 0.7,
      influencingFactors: ['life_appointment_next'],
      timingNote: `Starts ${nextAppt.startsAt.toISOString().slice(0, 16)} (UTC).`,
    });
  }

  if (cards.length === 0) {
    cards.push({
      id: 'steady',
      title: 'No strong adaptive nudge right now',
      rationale:
        'Signals look steady enough that aggressive replanning is not indicated — check Obligations if you feel otherwise.',
      confidence: 0.55,
      influencingFactors: ['baseline'],
      timingNote: 'Re-run brief generation after new data if needed.',
    });
  }

  return { enabled: true, disclaimer: DISCLAIMER, cards };
}
