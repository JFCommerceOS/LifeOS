import type { SignalType } from '@prisma/client';
import {
  extractDeadlineCandidates,
  extractPersonCandidates,
  extractTopicHint,
} from '../lib/deterministic-intake-parsing.js';

export type NormalizedFields = {
  normalizedText: string;
  normalizedTimeJson: string;
  candidatePeopleJson: string;
  candidatePlaceJson: string;
  candidateTopicsJson: string;
  candidateTasksJson: string;
  candidateDeadlinesJson: string;
  candidateRelationshipHintsJson: string;
  candidateRoutineHintsJson: string;
};

function extractPrimaryText(signalType: SignalType, payload: unknown): string {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload.trim();
  if (typeof payload !== 'object') return String(payload);
  const o = payload as Record<string, unknown>;

  if (signalType === 'CALENDAR_EVENT') {
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    const desc = typeof o.description === 'string' ? o.description.trim() : '';
    const parts: string[] = [];
    if (title) parts.push(title);
    if (desc) parts.push(desc);
    if (typeof o.startsAt === 'string') parts.push(`starts ${o.startsAt}`);
    if (typeof o.endsAt === 'string') parts.push(`ends ${o.endsAt}`);
    return parts.join('\n').trim();
  }

  if (signalType === 'TASK_ITEM') {
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    const due = typeof o.dueAt === 'string' ? o.dueAt : null;
    return [title, due ? `due ${due}` : ''].filter(Boolean).join('\n').trim();
  }

  if (signalType === 'EMAIL_THREAD_METADATA') {
    const subj = typeof o.subject === 'string' ? o.subject.trim() : '';
    const from = typeof o.from === 'string' ? o.from.trim() : '';
    const thr = typeof o.threadId === 'string' ? o.threadId : '';
    return [subj, from ? `from ${from}` : '', thr ? `thread ${thr}` : ''].filter(Boolean).join('\n').trim();
  }

  const text =
    (typeof o.body === 'string' && o.body) ||
    (typeof o.text === 'string' && o.text) ||
    (typeof o.content === 'string' && o.content) ||
    (typeof o.transcript === 'string' && o.transcript) ||
    (typeof o.summary === 'string' && o.summary) ||
    '';
  if (text) return text.trim();
  const title = typeof o.title === 'string' ? o.title : '';
  const desc = typeof o.description === 'string' ? o.description : '';
  return [title, desc].filter(Boolean).join('\n').trim();
}

function timeRangeFromPayload(payload: unknown): Record<string, unknown> {
  if (payload == null || typeof payload !== 'object') return {};
  const o = payload as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof o.startsAt === 'string') out.startsAt = o.startsAt;
  if (typeof o.endsAt === 'string') out.endsAt = o.endsAt;
  if (typeof o.start === 'string') out.start = o.start;
  if (typeof o.end === 'string') out.end = o.end;
  if (typeof o.day === 'string') out.day = o.day;
  if (typeof o.dueAt === 'string') out.dueAt = o.dueAt;
  return out;
}

function cleanWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Deterministic normalization: raw JSON stays in envelope; this is structured prep for extraction. */
export function normalizeSignalEnvelope(envelope: {
  signalType: SignalType;
  rawPayloadJson: string;
}): NormalizedFields {
  let parsed: unknown;
  try {
    parsed = JSON.parse(envelope.rawPayloadJson) as unknown;
  } catch {
    parsed = { text: envelope.rawPayloadJson };
  }

  let normalizedText = extractPrimaryText(envelope.signalType, parsed);
  normalizedText = cleanWhitespace(normalizedText);

  const normalizedTimeJson = JSON.stringify(timeRangeFromPayload(parsed));

  const topics: string[] = [];
  if (typeof parsed === 'object' && parsed && 'topics' in parsed && Array.isArray((parsed as { topics: unknown }).topics)) {
    for (const t of (parsed as { topics: string[] }).topics) {
      if (typeof t === 'string') topics.push(t);
    }
  }

  const people = extractPersonCandidates(normalizedText);
  const dl = extractDeadlineCandidates(normalizedText);
  const hint = extractTopicHint(normalizedText);

  return {
    normalizedText,
    normalizedTimeJson,
    candidatePeopleJson: JSON.stringify(people),
    candidatePlaceJson: '{}',
    candidateTopicsJson: JSON.stringify(topics.length ? topics : hint ? [hint] : []),
    candidateTasksJson: '[]',
    candidateDeadlinesJson: JSON.stringify(dl),
    candidateRelationshipHintsJson: '[]',
    candidateRoutineHintsJson: '[]',
  };
}
