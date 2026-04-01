import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/** Stable JSON shape for `GET /api/v1/briefs/daily/latest` (Sprint 01 contract). */
const briefItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  bucket: z.enum(['do_now', 'do_today', 'before_meeting', 'watch_week', 'needs_confirmation']),
  oneLine: z.string().nullable().optional(),
  refType: z.string().nullable().optional(),
  refId: z.string().nullable().optional(),
});

const briefSchema = z.object({
  id: z.string(),
  day: z.union([z.string(), z.date()]),
  items: z.array(briefItemSchema),
});

const latestBriefResponseSchema = z.object({
  brief: briefSchema.nullable(),
});

describe('Daily Brief API contract (Sprint 01)', () => {
  it('accepts a typical latest-brief payload', () => {
    const parsed = latestBriefResponseSchema.safeParse({
      brief: {
        id: 'b1',
        day: '2026-03-30',
        items: [
          {
            id: 'i1',
            title: 'Follow up on note',
            bucket: 'do_now',
            oneLine: null,
            refType: 'Obligation',
            refId: 'ob1',
          },
        ],
      },
    });
    expect(parsed.success).toBe(true);
  });
});
