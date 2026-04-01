import { prisma } from '@life-os/database';

/** Move expired snoozed suggestions back to pending so they appear in lists and briefs. */
export async function unsnoozeExpiredSuggestions(userId: string): Promise<void> {
  await prisma.suggestion.updateMany({
    where: {
      userId,
      state: 'snoozed',
      snoozedUntil: { lte: new Date() },
    },
    data: { state: 'pending', snoozedUntil: null },
  });
}
