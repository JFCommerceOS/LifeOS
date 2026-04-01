import { prisma } from '@life-os/database';

/** Remove stored brief rows for a suggestion so GET /briefs/daily/latest stays consistent after actions. */
export async function removeDailyBriefItemsForSuggestion(userId: string, suggestionId: string): Promise<void> {
  await prisma.dailyBriefItem.deleteMany({
    where: { userId, refType: 'Suggestion', refId: suggestionId },
  });
}
