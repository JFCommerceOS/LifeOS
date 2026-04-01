import type { ConnectorSyncRunType } from '@prisma/client';
import { prisma } from '@life-os/database';
import { generateDailyBriefForUser } from './brief-engine.js';
import { fetchAdapterItems } from './connector-adapters.js';
import { purgeConnectorImportedData } from './connector-purge-service.js';
import { markSourceRecordApplied, upsertSourceRecord } from './source-record-ingestion-service.js';
import { applyNormalizationBridge } from './source-normalization-bridge-service.js';
import { defaultPermissionsForType } from './connector-registry-service.js';
import { recomputeSuggestionsForUser } from './suggestion-engine.js';

export async function seedConnectorPermissions(connectorId: string, connectorType: Parameters<typeof defaultPermissionsForType>[0]) {
  const keys = defaultPermissionsForType(connectorType);
  for (const permissionKey of keys) {
    const existing = await prisma.connectorPermission.findFirst({
      where: { connectorId, permissionKey },
    });
    if (!existing) {
      await prisma.connectorPermission.create({
        data: { connectorId, permissionKey, granted: true, grantedAt: new Date() },
      });
    } else if (!existing.granted) {
      await prisma.connectorPermission.update({
        where: { id: existing.id },
        data: { granted: true, grantedAt: new Date() },
      });
    }
  }
}

async function finishRun(
  runId: string,
  data: {
    runStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    recordsSeen: number;
    recordsInserted: number;
    recordsUpdated: number;
    recordsFailed: number;
    errorSummary: string | null;
  },
) {
  await prisma.connectorSyncRun.update({
    where: { id: runId },
    data: {
      ...data,
      completedAt: new Date(),
    },
  });
}

export async function runConnectorSync(
  userId: string,
  connectorId: string,
  runType: ConnectorSyncRunType,
): Promise<{
  runId: string;
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
}> {
  const connector = await prisma.sourceConnector.findFirst({ where: { id: connectorId, userId } });
  if (!connector) throw new Error('NOT_FOUND');
  if (connector.status !== 'ACTIVE' || !connector.enabled) {
    throw new Error('CONNECTOR_NOT_SYNCABLE');
  }

  const run = await prisma.connectorSyncRun.create({
    data: {
      connectorId,
      runType,
      runStatus: 'RUNNING',
    },
  });

  let recordsSeen = 0;
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let recordsFailed = 0;
  let lastError: string | null = null;

  try {
    const fetchResult = fetchAdapterItems(connector.connectorType, connector.cursorJson);
    recordsSeen = fetchResult.items.length;

    for (const item of fetchResult.items) {
      try {
        const payloadJson = JSON.stringify(item.payload);
        const normalizedJson = JSON.stringify({ kind: item.sourceKind, version: 1 });
        const up = await upsertSourceRecord({
          userId,
          connectorId,
          externalId: item.externalId,
          sourceKind: item.sourceKind,
          sourceUpdatedAt: item.sourceUpdatedAt,
          payloadJson,
          normalizedJson,
        });
        if (up.inserted) recordsInserted += 1;
        else if (up.updated) recordsUpdated += 1;

        if (!up.unchanged) {
          await applyNormalizationBridge({
            userId,
            connectorId,
            connectorType: connector.connectorType,
            sourceRecord: up.record,
            skipContinuityEffects: true,
          });
          await markSourceRecordApplied(up.record.id);
        }
      } catch (e) {
        recordsFailed += 1;
        lastError = e instanceof Error ? e.message : 'item_failed';
      }
    }

    await prisma.sourceConnector.update({
      where: { id: connectorId },
      data: {
        cursorJson: JSON.stringify(fetchResult.nextCursor),
        lastSyncAt: new Date(),
      },
    });

    const runStatus =
      recordsFailed > 0 && recordsInserted + recordsUpdated === 0
        ? 'FAILED'
        : recordsFailed > 0
          ? 'PARTIAL'
          : 'SUCCESS';

    await finishRun(run.id, {
      runStatus,
      recordsSeen,
      recordsInserted,
      recordsUpdated,
      recordsFailed,
      errorSummary: lastError,
    });

    await recomputeSuggestionsForUser(userId);
    await generateDailyBriefForUser(userId);

    return { runId: run.id, recordsSeen, recordsInserted, recordsUpdated, recordsFailed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'sync_failed';
    await finishRun(run.id, {
      runStatus: 'FAILED',
      recordsSeen,
      recordsInserted,
      recordsUpdated,
      recordsFailed,
      errorSummary: msg,
    });
    throw e;
  }
}

export async function runConnectorResync(userId: string, connectorId: string) {
  await purgeConnectorImportedData(userId, connectorId, 'resync');
  return runConnectorSync(userId, connectorId, 'RESYNC');
}

export async function runConnectorPurge(userId: string, connectorId: string) {
  const result = await purgeConnectorImportedData(userId, connectorId, 'user_purge');
  await prisma.connectorSyncRun.create({
    data: {
      connectorId,
      runType: 'PURGE',
      runStatus: 'SUCCESS',
      recordsSeen: result.affectedRecordCount,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      completedAt: new Date(),
    },
  });
  await recomputeSuggestionsForUser(userId);
  await generateDailyBriefForUser(userId);
  return result;
}
