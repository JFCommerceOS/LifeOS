import { prisma } from '@life-os/database';
import type { PlaceSensitivity } from '@prisma/client';
import { resolveSavedPlaceIdFromLabel } from './place-resolution-service.js';

export type CreatePlaceEventInput = {
  userId: string;
  occurredAt: Date;
  placeLabel: string;
  placeCategory?: string | null;
  durationMinutes?: number | null;
  masked?: boolean | null;
  source?: string | null;
  savedPlaceId?: string | null;
  /** When true and savedPlaceId absent, attempt resolution from placeLabel */
  resolveSavedPlace?: boolean;
};

function inheritMaskFromSavedPlace(
  saved: { sensitivity: PlaceSensitivity; defaultMasked: boolean },
  explicitMasked: boolean | null | undefined,
): boolean {
  if (typeof explicitMasked === 'boolean') return explicitMasked;
  if (saved.defaultMasked || saved.sensitivity === 'private_sensitive') return true;
  return false;
}

export async function createPlaceEventRow(input: CreatePlaceEventInput) {
  let savedPlaceId = input.savedPlaceId ?? null;
  const labelForResolve = input.placeLabel?.trim() ?? '';
  if (!savedPlaceId && input.resolveSavedPlace && labelForResolve) {
    savedPlaceId = await resolveSavedPlaceIdFromLabel(input.userId, labelForResolve);
  }

  let placeLabel = labelForResolve;
  let placeCategory = input.placeCategory ?? null;
  let masked = input.masked ?? false;

  if (savedPlaceId) {
    const sp = await prisma.savedPlace.findFirst({
      where: { id: savedPlaceId, userId: input.userId },
    });
    if (!sp) throw new Error('SAVED_PLACE_NOT_FOUND');
    if (!placeLabel.length) placeLabel = sp.label;
    placeCategory = placeCategory ?? sp.category ?? null;
    masked = inheritMaskFromSavedPlace(sp, input.masked);
  }

  if (!placeLabel.length) throw new Error('PLACE_LABEL_REQUIRED');

  return prisma.placeEvent.create({
    data: {
      userId: input.userId,
      occurredAt: input.occurredAt,
      placeLabel,
      placeCategory,
      durationMinutes: input.durationMinutes ?? undefined,
      masked,
      source: input.source ?? 'manual',
      savedPlaceId: savedPlaceId ?? undefined,
    },
    include: { savedPlace: true },
  });
}
