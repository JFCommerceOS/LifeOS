import type { PersonCorrectionType } from '@prisma/client';
import { prisma } from '@life-os/database';

export async function recordPersonCorrection(
  userId: string,
  personId: string,
  correctionType: PersonCorrectionType,
  correctionNote: string,
) {
  return prisma.personCorrection.create({
    data: {
      userId,
      personId,
      correctionType,
      correctionNote: correctionNote.slice(0, 4000),
    },
  });
}
