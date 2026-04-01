import type { SignalType } from '@prisma/client';
import {
  extractDeadlineCandidates,
  extractPersonCandidates,
  extractTopicHint,
  inferDueDateFromCandidates,
} from '../lib/deterministic-intake-parsing.js';

export type FactDraft = {
  factType: string;
  factValueJson: string;
  confidence: number;
  observedVsExtracted: string;
  evidenceExcerpt: string | null;
};

const ACTION_FOLLOW = /\b(follow\s*up|follow-up|followup)\b/i;
const ACTION_REPLY = /\b(reply\s+to|respond\s+to)\b/i;
const ACTION_NEED = /\b(need\s+to|must|should|remember\s+to|have\s+to|got\s+to)\b/i;
const ACTION_REVIEW = /\b(review\s+by|review\s+before|need\s+review|remind\s+me)\b/i;
const ACTION_SEND = /\b(send|check|verify|confirm|schedule|prepare\s+for|call|ask)\b/i;
const PROMISE = /\b(promise|committed|i\s+will|we\s+will|i'll|we'll)\b/i;
const EVENT_PREP = /\b(prepare\s+for|before\s+meeting|bring|review\s+deck|review\s+notes|send\s+materials)\b/i;

function clip(s: string, max = 220): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function matchExcerpt(text: string, re: RegExp): string | null {
  re.lastIndex = 0;
  const m = re.exec(text);
  if (!m) return null;
  const start = Math.max(0, m.index - 20);
  const end = Math.min(text.length, m.index + m[0].length + 40);
  return clip(text.slice(start, end), 180);
}

/** Sprint 02 — deterministic facts with phrase-tied excerpts and confidence tiers. */
export function extractFactsFromNormalized(args: {
  normalizedText: string;
  signalType: SignalType;
  referenceTime?: Date | null;
}): FactDraft[] {
  const { normalizedText, signalType } = args;
  const ref = args.referenceTime ?? new Date();
  const text = normalizedText.trim();
  const facts: FactDraft[] = [];

  if (!text) {
    facts.push({
      factType: 'EMPTY_SIGNAL',
      factValueJson: JSON.stringify({ signalType }),
      confidence: 0.2,
      observedVsExtracted: 'extracted',
      evidenceExcerpt: null,
    });
    return facts;
  }

  const people = extractPersonCandidates(text);
  const deadlines = extractDeadlineCandidates(text);
  const inferredDue = inferDueDateFromCandidates(deadlines, ref);

  const baseExcerpt = clip(text, 280);

  if (ACTION_FOLLOW.test(text) || ACTION_REPLY.test(text)) {
    const ex = matchExcerpt(text, ACTION_FOLLOW) ?? matchExcerpt(text, ACTION_REPLY);
    const hasDate = deadlines.length > 0 || inferredDue !== null;
    facts.push({
      factType: 'FOLLOW_UP_CUE',
      factValueJson: JSON.stringify({
        phrases: ['follow_up', 'reply'],
        people: people.map((p) => p.label),
      }),
      confidence: hasDate ? 0.82 : 0.58,
      observedVsExtracted: 'extracted',
      evidenceExcerpt: ex ?? baseExcerpt,
    });
  } else if (ACTION_NEED.test(text)) {
    facts.push({
      factType: 'FOLLOW_UP_CUE',
      factValueJson: JSON.stringify({ phrases: ['need_to'], people: people.map((p) => p.label) }),
      confidence: deadlines.length ? 0.78 : 0.52,
      observedVsExtracted: 'extracted',
      evidenceExcerpt: matchExcerpt(text, ACTION_NEED) ?? baseExcerpt,
    });
  }

  if (ACTION_REVIEW.test(text) || /\b(check|review)\b/i.test(text)) {
    facts.push({
      factType: 'REVIEW_CUE',
      factValueJson: JSON.stringify({}),
      confidence: 0.62,
      observedVsExtracted: 'extracted',
      evidenceExcerpt: matchExcerpt(text, ACTION_REVIEW) ?? baseExcerpt,
    });
  }

  if (ACTION_SEND.test(text)) {
    facts.push({
      factType: 'FOLLOW_UP_CUE',
      factValueJson: JSON.stringify({ phrases: ['action_send_check'], people: people.map((p) => p.label) }),
      confidence: 0.48,
      observedVsExtracted: 'extracted',
      evidenceExcerpt: matchExcerpt(text, ACTION_SEND) ?? baseExcerpt,
    });
  }

  if (PROMISE.test(text)) {
    facts.push({
      factType: 'PROMISE_CUE',
      factValueJson: JSON.stringify({}),
      confidence: 0.68,
      observedVsExtracted: 'extracted',
      evidenceExcerpt: matchExcerpt(text, PROMISE) ?? baseExcerpt,
    });
  }

  if (signalType === 'CALENDAR_EVENT' && EVENT_PREP.test(text)) {
    facts.push({
      factType: 'EVENT_PREP',
      factValueJson: JSON.stringify({}),
      confidence: 0.74,
      observedVsExtracted: 'extracted',
      evidenceExcerpt: matchExcerpt(text, EVENT_PREP) ?? baseExcerpt,
    });
  }

  for (const d of deadlines) {
    facts.push({
      factType: 'DEADLINE_REFERENCE',
      factValueJson: JSON.stringify({
        token: d.token,
        kind: d.kind,
        inferredIso: inferredDue?.toISOString() ?? null,
      }),
      confidence: inferredDue ? 0.8 : 0.45,
      observedVsExtracted: 'extracted',
      evidenceExcerpt: clip(d.token, 80),
    });
    break;
  }

  for (const d of deadlines.slice(0, 3)) {
    facts.push({
      factType: 'DATE_REFERENCE',
      factValueJson: JSON.stringify({ span: d.token, kind: d.kind }),
      confidence: 0.5,
      observedVsExtracted: 'extracted',
      evidenceExcerpt: clip(d.token, 80),
    });
  }

  const topic = extractTopicHint(text);
  if (topic) {
    facts.push({
      factType: 'TOPIC_REFERENCE',
      factValueJson: JSON.stringify({ topic }),
      confidence: 0.42,
      observedVsExtracted: 'extracted',
      evidenceExcerpt: clip(topic, 120),
    });
  }

  for (const p of people.slice(0, 6)) {
    facts.push({
      factType: 'PERSON_MENTION',
      factValueJson: JSON.stringify({ name: p.label, pattern: p.pattern }),
      confidence: p.confidence * 0.55,
      observedVsExtracted: 'extracted',
      evidenceExcerpt: clip(`with ${p.label}`, 80),
    });
  }

  facts.push({
    factType: 'SIGNAL_KIND',
    factValueJson: JSON.stringify({ signalType }),
    confidence: 0.92,
    observedVsExtracted: 'observed',
    evidenceExcerpt: baseExcerpt,
  });

  return dedupeFacts(facts);
}

function dedupeFacts(facts: FactDraft[]): FactDraft[] {
  const seen = new Set<string>();
  const out: FactDraft[] = [];
  for (const f of facts) {
    const key = `${f.factType}:${f.factValueJson}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
