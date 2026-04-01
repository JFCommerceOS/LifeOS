import { prisma } from '@life-os/database';
import type { SignalEnvelope } from '@prisma/client';

export type CapturePipelinePayload = {
  note?: unknown;
  event?: unknown;
  task?: unknown;
  signal: Pick<SignalEnvelope, 'id' | 'signalType' | 'processingStatus' | 'receivedAt'>;
  normalized: {
    normalizedText: string;
    candidatePeopleJson: string;
    candidateDeadlinesJson: string;
  } | null;
  facts: { id: string; factType: string; confidence: number; evidenceExcerpt: string | null }[];
  obligations: {
    id: string;
    title: string;
    obligationType: string | null;
    reasonSummary: string | null;
    confidence: number;
    dueAt: Date | null;
    evidenceCount: number;
  }[];
};

export async function buildCapturePipelinePayload(
  entity: { note?: unknown; event?: unknown; task?: unknown },
  signal: SignalEnvelope & {
    normalizedRecord: { normalizedText: string; candidatePeopleJson: string; candidateDeadlinesJson: string } | null;
    extractedFacts: { id: string; factType: string; confidence: number; evidenceExcerpt: string | null }[];
  },
): Promise<CapturePipelinePayload> {
  const obligations = await prisma.obligation.findMany({
    where: { sourceSignalId: signal.id },
    include: { _count: { select: { evidenceItems: true } } },
  });

  return {
    ...entity,
    signal: {
      id: signal.id,
      signalType: signal.signalType,
      processingStatus: signal.processingStatus,
      receivedAt: signal.receivedAt,
    },
    normalized: signal.normalizedRecord
      ? {
          normalizedText: signal.normalizedRecord.normalizedText,
          candidatePeopleJson: signal.normalizedRecord.candidatePeopleJson,
          candidateDeadlinesJson: signal.normalizedRecord.candidateDeadlinesJson,
        }
      : null,
    facts: signal.extractedFacts.map((f) => ({
      id: f.id,
      factType: f.factType,
      confidence: f.confidence,
      evidenceExcerpt: f.evidenceExcerpt,
    })),
    obligations: obligations.map((o) => ({
      id: o.id,
      title: o.title,
      obligationType: o.obligationType,
      reasonSummary: o.reasonSummary,
      confidence: o.confidence,
      dueAt: o.dueAt,
      evidenceCount: o._count.evidenceItems,
    })),
  };
}
