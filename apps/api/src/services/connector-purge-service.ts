import { prisma } from '@life-os/database';

/** Remove imported rows for a connector (source records, linked events/tasks, connector-tagged signals). */
export async function purgeConnectorImportedData(
  userId: string,
  connectorId: string,
  purgeScope: string,
): Promise<{ affectedRecordCount: number }> {
  const connector = await prisma.sourceConnector.findFirst({ where: { id: connectorId, userId } });
  if (!connector) throw new Error('NOT_FOUND');

  const sourceRows = await prisma.sourceRecord.findMany({
    where: { connectorId },
    select: { id: true },
  });

  let affected = 0;
  for (const { id } of sourceRows) {
    await prisma.event.deleteMany({ where: { userId, sourceRecordId: id } });
    await prisma.task.deleteMany({ where: { userId, sourceRecordId: id } });
    await prisma.suggestion.deleteMany({
      where: { userId, linkedEntityType: 'SourceRecord', linkedEntityId: id },
    });
    await prisma.signalEnvelope.deleteMany({ where: { userId, sourceRecordId: id } });
    await prisma.sourceRecord.delete({ where: { id } });
    affected++;
  }

  await prisma.connectorPurgeLog.create({
    data: {
      connectorId,
      purgeScope,
      affectedRecordCount: affected,
    },
  });

  await prisma.sourceConnector.update({
    where: { id: connectorId },
    data: { cursorJson: '{}' },
  });

  return { affectedRecordCount: affected };
}
