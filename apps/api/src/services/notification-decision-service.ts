import type {
  AssistantSurfaceType,
  MediationDecision,
  NotificationSurfaceKind,
  NotificationUrgencyLevel,
} from '@prisma/client';

export function phoneMediationAllowsNotification(
  decision: MediationDecision,
  targetSurface: AssistantSurfaceType,
): boolean {
  if (targetSurface !== 'phone' && targetSurface !== 'accessory') return false;
  return (
    decision === 'surface_now' ||
    decision === 'route_to_phone' ||
    (decision === 'escalate' && targetSurface === 'phone')
  );
}

export function categoryEnabled(
  kind: NotificationSurfaceKind,
  pref: {
    doNowEnabled: boolean;
    doTodayEnabled: boolean;
    beforeNextEventEnabled: boolean;
    adminAlertsEnabled: boolean;
    documentAlertsEnabled: boolean;
    studyAlertsEnabled: boolean;
    healthAlertsEnabled: boolean;
    digestEnabled: boolean;
  },
): boolean {
  switch (kind) {
    case 'DO_NOW':
      return pref.doNowEnabled;
    case 'DO_TODAY':
      return pref.doTodayEnabled;
    case 'DIGEST':
      return pref.digestEnabled;
    case 'BEFORE_NEXT_EVENT':
      return pref.beforeNextEventEnabled;
    case 'ADMIN_DUE':
      return pref.adminAlertsEnabled;
    case 'DOCUMENT_REVIEW':
      return pref.documentAlertsEnabled;
    case 'MEMORY_CONFIRMATION':
      return pref.healthAlertsEnabled;
    case 'CONTEXT_PREP':
      return pref.doTodayEnabled || pref.studyAlertsEnabled;
    default:
      return true;
  }
}

export function inferNotificationKindAndUrgency(args: {
  linkedObligationDueAt: Date | null;
  now: Date;
  confidence: number;
  obligationType: string | null;
  /** When mediating a suggestion without a usable obligation anchor, treat as context prep. */
  fallbackSurfaceKind: NotificationSurfaceKind;
}): { urgencyLevel: NotificationUrgencyLevel; notificationSurfaceKind: NotificationSurfaceKind } {
  const { linkedObligationDueAt: dueAt, now, confidence, obligationType, fallbackSurfaceKind } = args;
  let notificationSurfaceKind: NotificationSurfaceKind = fallbackSurfaceKind;
  let urgencyLevel: NotificationUrgencyLevel = confidence >= 0.75 ? 'HIGH' : 'NORMAL';

  if (obligationType?.toLowerCase().includes('admin')) notificationSurfaceKind = 'ADMIN_DUE';
  else if (obligationType?.toLowerCase().includes('document')) notificationSurfaceKind = 'DOCUMENT_REVIEW';

  if (dueAt) {
    const ms = dueAt.getTime() - now.getTime();
    if (ms <= 2 * 60 * 60 * 1000 && ms >= 0) {
      notificationSurfaceKind = 'DO_NOW';
      urgencyLevel = 'HIGH';
    } else if (ms <= 24 * 60 * 60 * 1000) {
      if (notificationSurfaceKind !== 'ADMIN_DUE' && notificationSurfaceKind !== 'DOCUMENT_REVIEW') {
        notificationSurfaceKind = 'DO_TODAY';
      }
    }
  }

  if (confidence < 0.4) urgencyLevel = 'LOW';

  return { urgencyLevel, notificationSurfaceKind };
}
