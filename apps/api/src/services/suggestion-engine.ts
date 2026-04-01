import { prisma } from '@life-os/database';
import { lifestyleRankMultiplier } from '../lib/phase5-lifestyle.js';
import { locationRankMultiplier } from '../lib/location-rank-modifier.js';
import { patternRankMultiplier } from '../lib/pattern-insights.js';
import { profileRankMultiplier } from '../lib/profile-rank.js';
import { unsnoozeExpiredSuggestions } from '../lib/suggestion-lifecycle.js';
import { ACTIVE_OBLIGATION_STATUSES } from '../lib/obligation-active.js';
import { linkObligationSuggestionMemory } from './continuity-memory-graph.js';
import { mediateSuggestion } from './assistant-mediation-service.js';

/** Recompute pending suggestions from open obligations (Phase 0 stub). */
export async function recomputeSuggestionsForUser(userId: string): Promise<{ created: number }> {
  await unsnoozeExpiredSuggestions(userId);

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const profileMult = profileRankMultiplier(profile);
  const patternMult = await patternRankMultiplier(userId);
  const lifestyleMult = await lifestyleRankMultiplier(userId);
  const locationMult = await locationRankMultiplier(userId);

  const open = await prisma.obligation.findMany({
    where: { userId, status: { in: [...ACTIVE_OBLIGATION_STATUSES] } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  let created = 0;
  for (const ob of open) {
    // Idempotent: at most one suggestion per linked obligation. If the user already has
    // pending/snoozed work, or dismissed / false_positive / accepted a row for this link,
    // do not create another — otherwise recompute would resurrect noise after explicit actions.
    const existingForLink = await prisma.suggestion.findFirst({
      where: {
        userId,
        OR: [{ linkedObligationId: ob.id }, { linkedEntityType: 'Obligation', linkedEntityId: ob.id }],
      },
    });
    if (existingForLink) continue;

    const baseRank = ob.dueAt ? Math.max(0, 100 - (Date.now() - ob.dueAt.getTime()) / 86400000) : 10;
    const rank = baseRank * profileMult * patternMult * lifestyleMult * locationMult;

    const suggestion = await prisma.suggestion.create({
      data: {
        userId,
        title: ob.title,
        reason: 'Open obligation detected',
        confidence: 0.7,
        rank,
        linkedEntityType: 'Obligation',
        linkedEntityId: ob.id,
        linkedObligationId: ob.id,
        suggestionType: 'obligation_followup',
      },
    });

    const mediation = await mediateSuggestion({
      userId,
      sourceEntityType: 'Suggestion',
      sourceEntityId: suggestion.id,
      rank,
      confidence: 0.7,
      linkedObligationId: ob.id,
    });

    await prisma.suggestion.update({
      where: { id: suggestion.id },
      data: {
        surfacedFromMediationLogId: mediation.logId,
        reason: mediation.reasonSummary ?? 'Open obligation detected',
      },
    });

    await linkObligationSuggestionMemory({
      userId,
      obligationId: ob.id,
      obligationTitle: ob.title,
      suggestionId: suggestion.id,
      suggestionTitle: suggestion.title,
    });

    await prisma.evidenceItem.create({
      data: {
        userId,
        suggestionId: suggestion.id,
        kind: 'observed',
        summary: `Obligation ${ob.id} is open`,
        sourceRef: ob.id,
      },
    });

    await prisma.suggestionRankFactor.create({
      data: {
        userId,
        suggestionId: suggestion.id,
        name: 'urgency',
        weight: 1,
        value: baseRank,
      },
    });

    await prisma.suggestionRankFactor.create({
      data: {
        userId,
        suggestionId: suggestion.id,
        name: 'profile_tune',
        weight: 0.2,
        value: profileMult,
      },
    });

    await prisma.suggestionRankFactor.create({
      data: {
        userId,
        suggestionId: suggestion.id,
        name: 'pattern_rhythm',
        weight: 0.15,
        value: patternMult,
      },
    });

    await prisma.suggestionRankFactor.create({
      data: {
        userId,
        suggestionId: suggestion.id,
        name: 'lifestyle_load',
        weight: 0.12,
        value: lifestyleMult,
      },
    });

    await prisma.suggestionRankFactor.create({
      data: {
        userId,
        suggestionId: suggestion.id,
        name: 'location_context',
        weight: 0.08,
        value: locationMult,
      },
    });

    created += 1;
  }

  return { created };
}
