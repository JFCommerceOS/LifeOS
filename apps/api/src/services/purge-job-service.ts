import type { PurgeExecutionMode } from '@prisma/client';
import { prisma } from '@life-os/database';
import { purgeConnectorImportedData } from './connector-purge-service.js';

export async function createAndRunPurgeJob(
  userId: string,
  scopeType: string,
  scopeId: string | null,
  category: string,
  executionMode: PurgeExecutionMode,
) {
  const job = await prisma.purgeJob.create({
    data: {
      userId,
      scopeType,
      scopeId: scopeId ?? undefined,
      category,
      executionMode,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  try {
    let result: Record<string, unknown> = {};

    if (scopeType === 'connector' && scopeId && executionMode !== 'DISCONNECT_ONLY') {
      const n = await purgeConnectorImportedData(userId, scopeId, 'purge_job');
      result = { affectedRecordCount: n.affectedRecordCount };
      if (executionMode === 'SOFT_DELETE') {
        await prisma.sourceConnector.update({
          where: { id: scopeId },
          data: { status: 'DISCONNECTED', enabled: false },
        });
      }
    } else if (scopeType === 'connector' && scopeId && executionMode === 'DISCONNECT_ONLY') {
      await prisma.sourceConnector.update({
        where: { id: scopeId, userId },
        data: { status: 'DISCONNECTED', enabled: false },
      });
      result = { disconnected: true };
    } else {
      result = { note: 'No purge executed for this scope — use connector purge or category policy.' };
    }

    await prisma.purgeJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        resultJson: JSON.stringify(result),
      },
    });
    return prisma.purgeJob.findUniqueOrThrow({ where: { id: job.id } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'purge_failed';
    await prisma.purgeJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        resultJson: JSON.stringify({ error: msg }),
      },
    });
    throw e;
  }
}
