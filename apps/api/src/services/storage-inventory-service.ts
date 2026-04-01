import { prisma } from '@life-os/database';
import type { DataSensitivityLevel, RetentionClass } from '@prisma/client';

export type InventoryCategoryRow = {
  category: string;
  count: number;
  sensitivityLevel: DataSensitivityLevel;
  retentionClass: RetentionClass;
  sourceTypes: string[];
  notes: string;
};

const CATEGORY_META: Record<
  string,
  { sensitivity: DataSensitivityLevel; retentionClass: RetentionClass; sourceTypes: string[]; notes: string }
> = {
  notes: {
    sensitivity: 'NORMAL',
    retentionClass: 'WARM_CONTINUITY',
    sourceTypes: ['manual', 'voice', 'capture'],
    notes: 'Text you captured or dictated.',
  },
  events: {
    sensitivity: 'NORMAL',
    retentionClass: 'WARM_CONTINUITY',
    sourceTypes: ['manual', 'connector'],
    notes: 'Calendar-style items; connector-linked rows retain source linkage.',
  },
  tasks: {
    sensitivity: 'NORMAL',
    retentionClass: 'WARM_CONTINUITY',
    sourceTypes: ['manual', 'connector'],
    notes: 'Tasks and errands; may link to connector source records.',
  },
  obligations: {
    sensitivity: 'ELEVATED',
    retentionClass: 'HOT_ACTIVE',
    sourceTypes: ['signals', 'documents', 'admin'],
    notes: 'Follow-through items derived from capture or admin records.',
  },
  suggestions: {
    sensitivity: 'NORMAL',
    retentionClass: 'WARM_CONTINUITY',
    sourceTypes: ['mediation', 'patterns'],
    notes: 'Ranked nudges; dismiss or confirm in product.',
  },
  memory_nodes: {
    sensitivity: 'ELEVATED',
    retentionClass: 'SEMANTIC_LONG_LIFE',
    sourceTypes: ['signals', 'corrections'],
    notes: 'Continuity memory graph; correctable.',
  },
  evidence_items: {
    sensitivity: 'ELEVATED',
    retentionClass: 'EVIDENCE_SHORT_LIFE',
    sourceTypes: ['documents', 'connectors', 'inferred'],
    notes: 'Pointers to evidence; raw payloads may expire sooner than summaries.',
  },
  documents: {
    sensitivity: 'SENSITIVE',
    retentionClass: 'EVIDENCE_SHORT_LIFE',
    sourceTypes: ['upload', 'camera'],
    notes: 'Uploaded files + OCR; health/finance domains are more sensitive.',
  },
  admin_records: {
    sensitivity: 'SENSITIVE',
    retentionClass: 'WARM_CONTINUITY',
    sourceTypes: ['documents', 'notes'],
    notes: 'Bills, receipts, renewals — Admin Guard.',
  },
  source_connectors: {
    sensitivity: 'ELEVATED',
    retentionClass: 'WARM_CONTINUITY',
    sourceTypes: ['user_enabled'],
    notes: 'Connector registrations; scope is user-approved.',
  },
  source_records: {
    sensitivity: 'ELEVATED',
    retentionClass: 'EVIDENCE_SHORT_LIFE',
    sourceTypes: ['connectors'],
    notes: 'Normalized connector payloads; purge via connector controls.',
  },
  audit_logs: {
    sensitivity: 'NORMAL',
    retentionClass: 'SEMANTIC_LONG_LIFE',
    sourceTypes: ['system'],
    notes: 'Minimal privacy/security audit trail; not full content logs.',
  },
  connector_sync_runs: {
    sensitivity: 'NORMAL',
    retentionClass: 'WARM_CONTINUITY',
    sourceTypes: ['connectors'],
    notes: 'Sync history for troubleshooting.',
  },
};

export async function computeStorageInventory(userId: string): Promise<{
  categories: InventoryCategoryRow[];
  generatedAt: string;
}> {
  const [
    notes,
    events,
    tasks,
    obligations,
    suggestions,
    memoryNodes,
    evidenceItems,
    documents,
    adminRecords,
    sourceConnectors,
    sourceRecords,
    auditLogs,
    connectorSyncRuns,
  ] = await Promise.all([
    prisma.note.count({ where: { userId, archivedAt: null } }),
    prisma.event.count({ where: { userId, archivedAt: null } }),
    prisma.task.count({ where: { userId, archivedAt: null } }),
    prisma.obligation.count({ where: { userId } }),
    prisma.suggestion.count({ where: { userId } }),
    prisma.memoryNode.count({ where: { userId } }),
    prisma.evidenceItem.count({ where: { userId } }),
    prisma.document.count({ where: { userId } }),
    prisma.adminRecord.count({ where: { userId } }),
    prisma.sourceConnector.count({ where: { userId } }),
    prisma.sourceRecord.count({ where: { userId } }),
    prisma.auditLog.count({ where: { userId } }),
    prisma.connectorSyncRun.count({ where: { connector: { userId } } }),
  ]);

  const counts: Record<string, number> = {
    notes,
    events,
    tasks,
    obligations,
    suggestions,
    memory_nodes: memoryNodes,
    evidence_items: evidenceItems,
    documents,
    admin_records: adminRecords,
    source_connectors: sourceConnectors,
    source_records: sourceRecords,
    audit_logs: auditLogs,
    connector_sync_runs: connectorSyncRuns,
  };

  const categories: InventoryCategoryRow[] = Object.keys(CATEGORY_META).map((category) => {
    const m = CATEGORY_META[category]!;
    return {
      category,
      count: counts[category] ?? 0,
      sensitivityLevel: m.sensitivity,
      retentionClass: m.retentionClass,
      sourceTypes: m.sourceTypes,
      notes: m.notes,
    };
  });

  return { categories, generatedAt: new Date().toISOString() };
}

export async function persistInventorySnapshot(userId: string): Promise<{ id: string }> {
  const inv = await computeStorageInventory(userId);
  const row = await prisma.storageInventorySnapshot.create({
    data: {
      userId,
      snapshotJson: JSON.stringify(inv),
      generatedAt: new Date(),
    },
  });
  return { id: row.id };
}
