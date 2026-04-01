import { prisma } from '@life-os/database';
import { placeEventExcludedFromPatternInsights } from './sensitive-place-guard.js';

/** Light rank tuning when lifestyle opt-in and workload is high (assistive, not prescriptive). */
export async function lifestyleRankMultiplier(userId: string): Promise<number> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.lifestyleInsightsOptIn) return 1;
  const openObs = await prisma.obligation.count({ where: { userId, status: 'open' } });
  if (openObs >= 12) return 0.96;
  if (openObs >= 8) return 0.98;
  return 1;
}

export type LifestyleInsightPayload = {
  optIn: boolean;
  disclaimer: string;
  workloadHints: string[];
  balanceHints: string[];
  diningActivityHints: string[];
};

export type RoutineInsightPayload = {
  optIn: boolean;
  disclaimer: string;
  consistencyHints: string[];
  driftHints: string[];
};

const NON_MEDICAL =
  'This is lifestyle support only — not medical advice. Tune or disable these hints in Settings.';

/** Non-diagnostic lifestyle nudges (Phase 5). Gated on lifestyleInsightsOptIn. */
export async function buildLifestyleInsights(userId: string): Promise<LifestyleInsightPayload> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const optIn = settings?.lifestyleInsightsOptIn ?? false;
  if (!optIn) {
    return {
      optIn: false,
      disclaimer: NON_MEDICAL,
      workloadHints: ['Lifestyle insights are off. Enable them in Settings to see workload and balance hints.'],
      balanceHints: [],
      diningActivityHints: [],
    };
  }

  const workloadHints: string[] = [];
  const balanceHints: string[] = [];
  const diningActivityHints: string[] = [];

  const openObs = await prisma.obligation.count({ where: { userId, status: 'open' } });
  if (openObs >= 8) {
    workloadHints.push(
      `You have several open follow-ups (${openObs}). Batching or closing a few may reduce mental load.`,
    );
  } else if (openObs >= 4) {
    workloadHints.push(`Open follow-ups: ${openObs}. A short triage pass might help clarity.`);
  }

  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 86400000);
  const dueSoon = await prisma.deadline.count({
    where: { userId, dueAt: { gte: now, lte: twoWeeksOut } },
  });
  if (dueSoon >= 5) {
    workloadHints.push(
      `Several deadlines land in the next two weeks (${dueSoon}). Consider spacing or delegating where possible.`,
    );
  }

  const st = await prisma.screenTimeSummary.findMany({
    where: { userId },
    orderBy: { day: 'desc' },
    take: 7,
  });
  const lateTotal = st.reduce((a, s) => a + s.lateNightMinutes, 0);
  if (st.length >= 3 && lateTotal > 120) {
    balanceHints.push(
      'Late-evening screen time has been noticeable lately. Earlier wind-down may support better focus tomorrow.',
    );
  }

  const since = new Date(Date.now() - 21 * 86400000);
  const placesRaw = await prisma.placeEvent.findMany({
    where: { userId, occurredAt: { gte: since } },
    include: { savedPlace: true },
  });
  const places = placesRaw.filter(
    (p) =>
      !placeEventExcludedFromPatternInsights({
        masked: p.masked,
        savedPlace: p.savedPlace
          ? { sensitivity: p.savedPlace.sensitivity, defaultMasked: p.savedPlace.defaultMasked }
          : null,
      }),
  );
  const diningLike = places.filter((p) => {
    const c = (p.placeCategory ?? '').toLowerCase();
    const l = p.placeLabel.toLowerCase();
    return (
      c.includes('restaurant') ||
      c.includes('cafe') ||
      c.includes('dining') ||
      l.includes('restaurant') ||
      l.includes('cafe')
    );
  });
  if (diningLike.length >= 4) {
    diningActivityHints.push(
      `Several dining-out style visits appear in recent place labels (${diningLike.length} in ~3 weeks). Useful context for meal planning if you want it.`,
    );
  } else if (places.length > 0 && diningLike.length === 0) {
    diningActivityHints.push(
      'Dining/activity summaries stay light unless place labels suggest food venues — add categories if you want richer (still non-medical) context.',
    );
  }

  if (workloadHints.length === 0 && balanceHints.length === 0) {
    workloadHints.push('No strong workload signals from current data — a good time to keep routines steady.');
  }

  return {
    optIn: true,
    disclaimer: NON_MEDICAL,
    workloadHints,
    balanceHints,
    diningActivityHints,
  };
}

/** Routine drift / consistency hints from summarized signals only. */
export async function buildRoutineInsights(userId: string): Promise<RoutineInsightPayload> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const optIn = settings?.lifestyleInsightsOptIn ?? false;
  if (!optIn) {
    return {
      optIn: false,
      disclaimer: NON_MEDICAL,
      consistencyHints: ['Enable lifestyle insights in Settings to review routine consistency hints.'],
      driftHints: [],
    };
  }

  const consistencyHints: string[] = [];
  const driftHints: string[] = [];

  const st = await prisma.screenTimeSummary.findMany({
    where: { userId },
    orderBy: { day: 'desc' },
    take: 28,
  });
  if (st.length >= 10) {
    const half = Math.floor(st.length / 2);
    const older = st.slice(half);
    const newer = st.slice(0, half);
    const avg = (rows: typeof st) =>
      rows.length ? rows.reduce((a, s) => a + s.totalMinutes, 0) / rows.length : 0;
    const aOld = avg(older);
    const aNew = avg(newer);
    const diff = aNew - aOld;
    if (Math.abs(diff) > 45) {
      driftHints.push(
        `Total screen-time minutes shifted between recent and earlier days in this window (~${diff > 0 ? 'up' : 'down'}).`,
      );
    } else {
      consistencyHints.push('Screen-time totals look relatively steady across recent recorded days.');
    }
  } else if (st.length > 0) {
    consistencyHints.push('Add a few more daily screen-time summaries for stronger routine comparisons.');
  }

  const placeRowsRaw = await prisma.placeEvent.findMany({
    where: { userId },
    orderBy: { occurredAt: 'desc' },
    take: 40,
    include: { savedPlace: true },
  });
  const placeRows = placeRowsRaw.filter(
    (p) =>
      !placeEventExcludedFromPatternInsights({
        masked: p.masked,
        savedPlace: p.savedPlace
          ? { sensitivity: p.savedPlace.sensitivity, defaultMasked: p.savedPlace.defaultMasked }
          : null,
      }),
  );
  const unique = new Set(placeRows.map((p) => p.placeLabel));
  if (unique.size >= 4) {
    consistencyHints.push(
      `Place labels show variety (${unique.size} distinct labels recently) — routines may be flexible right now.`,
    );
  }

  if (driftHints.length === 0 && consistencyHints.length === 0) {
    consistencyHints.push('Not enough summarized data yet for drift — log screen time or place visits on the Patterns page.');
  }

  return {
    optIn: true,
    disclaimer: NON_MEDICAL,
    consistencyHints,
    driftHints,
  };
}
