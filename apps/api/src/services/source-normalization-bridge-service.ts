import type { ConnectorType, SourceRecord, SourceRecordKind } from '@prisma/client';
import { prisma } from '@life-os/database';
import { SignalSourceType } from '@prisma/client';
import { intakeSignal } from './signal-intake-service.js';

/** Apply normalized source record into Event/Task + signal envelope (idempotent at source-record hash level). */
export async function applyNormalizationBridge(input: {
  userId: string;
  connectorId: string;
  connectorType: ConnectorType;
  sourceRecord: SourceRecord;
  skipContinuityEffects: boolean;
}): Promise<{ eventId?: string; taskId?: string; signalId?: string }> {
  const { userId, connectorId, connectorType, sourceRecord, skipContinuityEffects } = input;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(sourceRecord.payloadJson) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const kind = sourceRecord.sourceKind;
  if (!kind) return {};

  if (kind === 'CALENDAR_EVENT') {
    const title = typeof payload.title === 'string' ? payload.title : 'Event';
    const startsAt =
      typeof payload.startsAt === 'string' ? new Date(payload.startsAt) : new Date();
    const endsAt = typeof payload.endsAt === 'string' ? new Date(payload.endsAt) : null;
    const description = typeof payload.description === 'string' ? payload.description : null;

    let event = await prisma.event.findFirst({ where: { userId, sourceRecordId: sourceRecord.id } });
    if (!event) {
      event = await prisma.event.create({
        data: {
          userId,
          title,
          description,
          startsAt,
          endsAt,
          sourceRecordId: sourceRecord.id,
        },
      });
    } else {
      event = await prisma.event.update({
        where: { id: event.id },
        data: { title, description, startsAt, endsAt },
      });
    }

    const rawPayloadJson = JSON.stringify({
      eventId: event.id,
      title,
      description,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt?.toISOString() ?? null,
      sourceConnectorId: connectorId,
      sourceRecordId: sourceRecord.id,
      observedFrom: 'connector',
      connectorType,
    });

    const env = await intakeSignal({
      userId,
      signalType: 'CALENDAR_EVENT',
      sourceType: SignalSourceType.connector,
      rawPayloadJson,
      sourceConnectorId: connectorId,
      sourceRecordId: sourceRecord.id,
      occurredAt: startsAt,
      trustLevel: 60,
      skipContinuityEffects,
    });
    return { eventId: event.id, signalId: env.id };
  }

  if (kind === 'TASK_RECORD') {
    const title = typeof payload.title === 'string' ? payload.title : 'Task';
    const dueAt = typeof payload.dueAt === 'string' ? new Date(payload.dueAt) : null;
    const done = payload.status === 'completed' || payload.status === 'done';

    let task = await prisma.task.findFirst({ where: { userId, sourceRecordId: sourceRecord.id } });
    if (!task) {
      task = await prisma.task.create({
        data: {
          userId,
          title,
          dueAt,
          done,
          sourceRecordId: sourceRecord.id,
        },
      });
    } else {
      task = await prisma.task.update({
        where: { id: task.id },
        data: { title, dueAt, done },
      });
    }

    const rawPayloadJson = JSON.stringify({
      taskId: task.id,
      title,
      dueAt: dueAt?.toISOString() ?? null,
      sourceConnectorId: connectorId,
      sourceRecordId: sourceRecord.id,
      observedFrom: 'connector',
      connectorType,
    });

    const env = await intakeSignal({
      userId,
      signalType: 'TASK_ITEM',
      sourceType: SignalSourceType.connector,
      rawPayloadJson,
      sourceConnectorId: connectorId,
      sourceRecordId: sourceRecord.id,
      occurredAt: dueAt ?? new Date(),
      trustLevel: 58,
      skipContinuityEffects,
    });
    return { taskId: task.id, signalId: env.id };
  }

  if (kind === 'EMAIL_THREAD_METADATA') {
    const subject = typeof payload.subject === 'string' ? payload.subject : 'Email thread';
    const strength = payload.evidenceStrength === 'weak' ? 'weak' : 'medium';

    const rawPayloadJson = JSON.stringify({
      sourceRecordId: sourceRecord.id,
      threadId: payload.threadId,
      subject,
      from: payload.from,
      sourceConnectorId: connectorId,
      observedFrom: 'connector',
      connectorType,
      evidenceStrength: strength,
    });

    const env = await intakeSignal({
      userId,
      signalType: 'EMAIL_THREAD_METADATA',
      sourceType: SignalSourceType.connector,
      rawPayloadJson,
      sourceConnectorId: connectorId,
      sourceRecordId: sourceRecord.id,
      trustLevel: strength === 'weak' ? 32 : 48,
      skipContinuityEffects,
    });

    const existing = await prisma.suggestion.findFirst({
      where: {
        userId,
        linkedEntityType: 'SourceRecord',
        linkedEntityId: sourceRecord.id,
        suggestionType: 'connector_email_review',
      },
    });
    if (!existing) {
      await prisma.suggestion.create({
        data: {
          userId,
          title: `Review: ${subject.slice(0, 120)}`,
          reason:
            strength === 'weak'
              ? 'Email metadata only — weak evidence; confirm before acting.'
              : 'Email metadata connector — review reply timing.',
          confidence: strength === 'weak' ? 0.32 : 0.48,
          rank: strength === 'weak' ? 0.15 : 0.35,
          linkedEntityType: 'SourceRecord',
          linkedEntityId: sourceRecord.id,
          suggestionType: 'connector_email_review',
        },
      });
    }

    return { signalId: env.id };
  }

  return {};
}
