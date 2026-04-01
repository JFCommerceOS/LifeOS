import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PolicyOutcome, PolicySurfaceKind } from '@prisma/client';

const createMock = vi.fn();

vi.mock('@life-os/database', () => ({
  prisma: {
    policyDecision: {
      create: createMock,
    },
  },
}));

describe('policy-decision-service', () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({});
  });

  it('recordPolicyDecision persists allow with reason codes', async () => {
    const { recordPolicyDecision } = await import('./policy-decision-service.js');
    await recordPolicyDecision({
      userId: 'u1',
      surface: PolicySurfaceKind.notification_delivery,
      outcome: PolicyOutcome.allow,
      reasonCodes: ['notification_surface_created'],
      context: { notificationType: 'DO_TODAY' },
      refEntityType: 'Obligation',
      refEntityId: 'ob1',
      notificationSurfaceEventId: 'n1',
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0].data;
    expect(arg.surface).toBe(PolicySurfaceKind.notification_delivery);
    expect(arg.outcome).toBe(PolicyOutcome.allow);
    expect(arg.reasonCodes).toEqual(['notification_surface_created']);
    expect(arg.notificationSurfaceEventId).toBe('n1');
  });
});
