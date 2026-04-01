import { createHash } from 'node:crypto';
import type { SourceRecord, SourceRecordKind } from '@prisma/client';
import { prisma } from '@life-os/database';

export function canonicalHashForPayload(payload: Record<string, unknown>): string {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(stable).digest('hex');
}

export async function upsertSourceRecord(input: {
  userId: string;
  connectorId: string;
  externalId: string;
  sourceKind: SourceRecordKind;
  sourceUpdatedAt: Date | null;
  payloadJson: string;
  normalizedJson: string | null;
}): Promise<{ record: SourceRecord; inserted: boolean; updated: boolean; unchanged: boolean }> {
  const payload = JSON.parse(input.payloadJson) as Record<string, unknown>;
  const hash = canonicalHashForPayload(payload);

  const existing = await prisma.sourceRecord.findFirst({
    where: { connectorId: input.connectorId, externalId: input.externalId },
  });

  if (existing) {
    if (existing.canonicalHash === hash) {
      return { record: existing, inserted: false, updated: false, unchanged: true };
    }
    const record = await prisma.sourceRecord.update({
      where: { id: existing.id },
      data: {
        payloadJson: input.payloadJson,
        normalizedJson: input.normalizedJson ?? undefined,
        sourceKind: input.sourceKind,
        sourceUpdatedAt: input.sourceUpdatedAt ?? undefined,
        canonicalHash: hash,
        ingestStatus: 'normalized',
        updatedAt: new Date(),
      },
    });
    return { record, inserted: false, updated: true, unchanged: false };
  }

  const record = await prisma.sourceRecord.create({
    data: {
      userId: input.userId,
      connectorId: input.connectorId,
      externalId: input.externalId,
      sourceKind: input.sourceKind,
      sourceUpdatedAt: input.sourceUpdatedAt ?? undefined,
      canonicalHash: hash,
      ingestStatus: 'normalized',
      payloadJson: input.payloadJson,
      normalizedJson: input.normalizedJson ?? undefined,
    },
  });
  return { record, inserted: true, updated: false, unchanged: false };
}

export type ApplyIngestArgs = {
  userId: string;
  connectorId: string;
  sourceRecord: SourceRecord;
  skipContinuityEffects: boolean;
};

/** Mark source record applied after bridge + pipeline (caller sets). */
export async function markSourceRecordApplied(id: string): Promise<void> {
  await prisma.sourceRecord.update({
    where: { id },
    data: { ingestStatus: 'applied', updatedAt: new Date() },
  });
}
