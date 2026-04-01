import type { BriefBucket, DailyBriefItem } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildMobileDeepLink, projectMobileBrief } from './mobile-brief-projection.js';

function item(over: Partial<DailyBriefItem> & Pick<DailyBriefItem, 'id' | 'title' | 'bucket'>): DailyBriefItem {
  return {
    userId: 'u',
    dailyBriefId: 'b',
    sortOrder: 0,
    oneLine: null,
    refType: 'Obligation',
    refId: 'o1',
    reasonSummary: null,
    evidenceCount: 0,
    priorityScore: 1,
    createdAt: new Date(),
    ...over,
  } as DailyBriefItem;
}

describe('mobile-brief-projection', () => {
  it('buildMobileDeepLink maps obligation to mobile path', () => {
    expect(buildMobileDeepLink('Obligation', 'x', 'do_now')).toBe('/m/obligations/x');
    expect(buildMobileDeepLink('Event', 'e1', 'do_today')).toBe('/events/e1');
  });

  it('top_action prefers do_now', () => {
    const sections = projectMobileBrief([
      item({ id: '1', title: 'Later', bucket: 'do_today' as BriefBucket }),
      item({ id: '2', title: 'Now', bucket: 'do_now' as BriefBucket }),
    ]);
    expect(sections.top_action[0]?.title).toBe('Now');
  });
});
