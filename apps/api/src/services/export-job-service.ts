import type { ExportEncryptionMode, ExportFormat } from '@prisma/client';
import { prisma } from '@life-os/database';
import { encryptAes256Gcm, resolveExportEncryptionKey } from '@life-os/security';

export async function buildExportPayload(userId: string, exportScope: string, includeSensitive: boolean) {
  const [user, settings, obligations, notes, events, tasks, suggestions, documents, adminRecords, connectors, sourceRecords] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.obligation.findMany({ where: { userId }, take: 500 }),
      prisma.note.findMany({ where: { userId, archivedAt: null }, take: 500 }),
      prisma.event.findMany({ where: { userId, archivedAt: null }, take: 500 }),
      prisma.task.findMany({ where: { userId, archivedAt: null }, take: 500 }),
      prisma.suggestion.findMany({ where: { userId }, take: 200, include: { evidence: true } }),
      prisma.document.findMany({ where: { userId }, take: 200 }),
      includeSensitive ? prisma.adminRecord.findMany({ where: { userId }, take: 200 }) : Promise.resolve([]),
      prisma.sourceConnector.findMany({ where: { userId }, take: 100 }),
      includeSensitive ? prisma.sourceRecord.findMany({ where: { userId }, take: 200 }) : Promise.resolve([]),
    ]);

  const documentsOut = documents.map((d) => {
    if (!includeSensitive && (d.documentFamily === 'HEALTH' || d.documentFamily === 'FINANCE_ADMIN')) {
      return { ...d, summaryLine: '[omitted in non-sensitive export]' };
    }
    return d;
  });

  return {
    exportedAt: new Date().toISOString(),
    version: 2,
    exportScope,
    includeSensitive,
    user,
    settings,
    obligations,
    notes,
    events,
    tasks,
    suggestions,
    documents: documentsOut,
    adminRecords,
    connectors,
    sourceRecords,
  };
}

function toMarkdownBundle(payload: Record<string, unknown>): string {
  const lines: string[] = ['# Life OS export (summary)', '', `Generated: ${payload.exportedAt}`, ''];
  lines.push('## Notes');
  lines.push('See JSON export for full structure. This bundle is a human-readable index.');
  lines.push('');
  return lines.join('\n');
}

export async function createAndRunExportJob(
  userId: string,
  exportScope: string,
  includeSensitive: boolean,
  format: ExportFormat,
  options?: { encryptionMode?: ExportEncryptionMode },
) {
  const encryptionMode = options?.encryptionMode ?? 'NONE';

  const job = await prisma.exportJob.create({
    data: {
      userId,
      exportScope,
      includeSensitive,
      format,
      status: 'RUNNING',
      encryptionMode,
    },
  });

  try {
    const payload = await buildExportPayload(userId, exportScope, includeSensitive);
    const json = JSON.stringify(payload, null, 2);
    let exportPayloadJson =
      format === 'markdown' ? JSON.stringify({ markdown: toMarkdownBundle(payload as Record<string, unknown>), json: payload }) : json;

    if (encryptionMode === 'AES256_GCM_DEV') {
      const key = resolveExportEncryptionKey();
      const ciphertext = encryptAes256Gcm(exportPayloadJson, key);
      exportPayloadJson = JSON.stringify({
        v: 1,
        encryption: 'AES256_GCM_DEV',
        ciphertext,
      });
    }

    const expiresAt =
      encryptionMode !== 'NONE' ? new Date(Date.now() + 7 * 86400000) : undefined;

    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        exportPayloadJson: exportPayloadJson.slice(0, 4_500_000),
        expiresAt: expiresAt ?? undefined,
      },
    });
    return prisma.exportJob.findUniqueOrThrow({ where: { id: job.id } });
  } catch (e) {
    await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', completedAt: new Date() },
    });
    throw e;
  }
}
