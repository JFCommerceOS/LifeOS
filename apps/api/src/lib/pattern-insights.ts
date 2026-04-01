import { prisma } from '@life-os/database';
import { placeEventExcludedFromPatternInsights } from './sensitive-place-guard.js';

export type PatternInsightPayload = {
  optIn: boolean;
  bullets: string[];
  poorReminderWindows: string[];
  nearPlaceHints: string[];
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Build privacy-safe narrative insights when pattern signals are opted in. */
export async function buildPatternInsights(userId: string): Promise<PatternInsightPayload> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const optIn = settings?.patternSignalsOptIn ?? false;
  if (!optIn) {
    return {
      optIn: false,
      bullets: ['Pattern insights are off. Enable “Pattern signals” in Settings to use summarized place and screen-time data.'],
      poorReminderWindows: [],
      nearPlaceHints: [],
    };
  }

  const bullets: string[] = [];
  const poorReminderWindows: string[] = [];
  const nearPlaceHints: string[] = [];

  const since = new Date(Date.now() - 14 * 86400000);
  const recentForInsights = await prisma.placeEvent.findMany({
    where: { userId, occurredAt: { gte: since } },
    include: { savedPlace: true },
  });
  const visible = recentForInsights.filter((e) =>
    !placeEventExcludedFromPatternInsights({
      masked: e.masked,
      savedPlace: e.savedPlace
        ? { sensitivity: e.savedPlace.sensitivity, defaultMasked: e.savedPlace.defaultMasked }
        : null,
    }),
  );
  if (visible.length > 0) {
    bullets.push(
      `Recorded ${visible.length} generalized place visit(s) in the last 14 days (sensitive visits omitted from this count).`,
    );
  }

  const recentPlaces = await prisma.placeEvent.findMany({
    where: { userId },
    orderBy: { occurredAt: 'desc' },
    take: 20,
    include: { savedPlace: true },
  });
  const labels = [
    ...new Set(
      recentPlaces
        .filter((p) =>
          !placeEventExcludedFromPatternInsights({
            masked: p.masked,
            savedPlace: p.savedPlace
              ? { sensitivity: p.savedPlace.sensitivity, defaultMasked: p.savedPlace.defaultMasked }
              : null,
          }),
        )
        .slice(0, 5)
        .map((p) => p.placeLabel),
    ),
  ];
  if (labels.length) {
    nearPlaceHints.push(`Recent labels include: ${labels.slice(0, 3).join(', ')}.`);
  }

  const st = await prisma.screenTimeSummary.findMany({
    where: { userId },
    orderBy: { day: 'desc' },
    take: 7,
  });
  const avgLate =
    st.length > 0 ? st.reduce((a, s) => a + s.lateNightMinutes, 0) / st.length : 0;
  if (avgLate > 45) {
    bullets.push('Late-night screen time has been elevated recently (metadata only).');
    poorReminderWindows.push('Late evening may be a weaker window for dense reminders.');
  }

  if (bullets.length === 0) {
    bullets.push('No pattern narrative yet — add place events or screen-time summaries.');
  }

  return { optIn: true, bullets, poorReminderWindows, nearPlaceHints };
}

export type FinancialInsightPayload = {
  duplicateSpendHints: string[];
  subscriptionSignals: string[];
};

export async function buildFinancialInsights(userId: string): Promise<FinancialInsightPayload> {
  const purchases = await prisma.purchase.findMany({
    where: { userId },
    orderBy: { purchasedAt: 'desc' },
    take: 100,
    select: { title: true, merchant: true, amount: true, purchasedAt: true },
  });

  const duplicateSpendHints: string[] = [];
  const key = (p: { title: string; merchant: string | null }) =>
    `${(p.merchant ?? '').toLowerCase()}|${p.title.toLowerCase()}`;
  const seen = new Map<string, number>();
  for (const p of purchases) {
    const k = key(p);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, count] of seen) {
    if (count > 1) {
      duplicateSpendHints.push(`Similar purchase pattern "${k.split('|')[1]}" appeared ${count} times.`);
    }
  }

  const subs = await prisma.subscription.findMany({
    where: { userId, active: true },
    select: { name: true, amount: true, renewalAt: true },
  });
  const subscriptionSignals: string[] = [];
  const now = Date.now();
  for (const s of subs) {
    if (s.amount != null && s.amount > 0 && s.renewalAt.getTime() > now) {
      subscriptionSignals.push(
        `${s.name}: renewal ${s.renewalAt.toISOString().slice(0, 10)} (~${s.amount}).`,
      );
    }
  }

  return { duplicateSpendHints, subscriptionSignals };
}

export async function patternRankMultiplier(userId: string): Promise<number> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.patternSignalsOptIn) return 1;

  const yesterday = new Date(Date.now() - 86400000);
  const dayKey = startOfUtcDay(yesterday);
  const st = await prisma.screenTimeSummary.findUnique({
    where: { userId_day: { userId, day: dayKey } },
  });
  if (st && st.lateNightMinutes > 60) return 0.97;
  return 1;
}
