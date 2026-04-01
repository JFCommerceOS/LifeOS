import { prisma } from '@life-os/database';

/** Explainability payload for Privacy Center / inspectors. */
export async function getDataLineage(userId: string, entityType: string, entityId: string) {
  switch (entityType) {
    case 'Note': {
      const row = await prisma.note.findFirst({ where: { id: entityId, userId } });
      if (!row) return null;
      return {
        entityType,
        entityId,
        observedVsExtracted: 'observed',
        sourceType: 'manual_capture',
        whyRetained: 'User-authored note for continuity.',
        retentionClass: 'WARM_CONTINUITY',
        archived: row.archivedAt != null,
      };
    }
    case 'Event': {
      const row = await prisma.event.findFirst({ where: { id: entityId, userId } });
      if (!row) return null;
      return {
        entityType,
        entityId,
        observedVsExtracted: row.sourceRecordId ? 'connector_derived' : 'observed',
        sourceType: row.sourceRecordId ? 'connector' : 'manual',
        sourceRecordId: row.sourceRecordId,
        whyRetained: row.sourceRecordId ? 'Imported or linked calendar event.' : 'User-created event.',
        retentionClass: 'WARM_CONTINUITY',
        archived: Boolean(row.archivedAt),
      };
    }
    case 'SourceRecord': {
      const row = await prisma.sourceRecord.findFirst({
        where: { id: entityId, userId },
        include: { connector: { select: { id: true, name: true, connectorType: true } } },
      });
      if (!row) return null;
      return {
        entityType,
        entityId,
        observedVsExtracted: 'connector_payload',
        sourceType: 'connector',
        connector: row.connector,
        sourceKind: row.sourceKind,
        whyRetained: 'Approved connector sync; purge via connector controls.',
        retentionClass: 'EVIDENCE_SHORT_LIFE',
      };
    }
    default:
      return {
        entityType,
        entityId,
        observedVsExtracted: 'unknown',
        sourceType: 'system',
        whyRetained: 'Stored for continuity per product rules.',
        retentionClass: 'WARM_CONTINUITY',
      };
  }
}
