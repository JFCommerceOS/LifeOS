import { describe, expect, it } from 'vitest';
import { renderNotificationForLockScreen } from './notification-lock-screen-render.js';

describe('notification-lock-screen-render', () => {
  it('private_default hides raw title', () => {
    const r = renderNotificationForLockScreen('private_default', {
      notificationType: 'DO_NOW',
      rawTitle: 'Pay $500 to Acme',
      rawBody: 'Secret',
      rawReason: 'Because',
    });
    expect(r.title).toContain('Life OS');
    expect(r.body).not.toContain('500');
  });

  it('full_detail keeps truncated title without obvious amount', () => {
    const r = renderNotificationForLockScreen('full_detail', {
      notificationType: 'DOCUMENT_REVIEW',
      rawTitle: 'Review syllabus',
      rawBody: 'Short note',
      rawReason: null,
    });
    expect(r.title).toContain('syllabus');
  });
});
