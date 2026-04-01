import {
  type AssistantSurfaceType,
  type MediationDecision,
  type NotificationPrivacyLevel,
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
  PolicyOutcome,
  PolicySurfaceKind,
} from '@prisma/client';
import { prisma } from '@life-os/database';
import { isInsideQuietHours } from '../lib/notification-quiet-hours.js';
import {
  categoryEnabled,
  inferNotificationKindAndUrgency,
  phoneMediationAllowsNotification,
} from './notification-decision-service.js';
import { ensureNotificationUserPreference } from './notification-user-preference.js';
import { recordPolicyDecision } from './policy-decision-service.js';

const DEDUPE_MS = 4 * 60 * 60 * 1000;
const NOTIFICATION_POLICY_SURFACE = PolicySurfaceKind.notification_delivery;

function heuristicPrivacy(
  title: string,
  obligationType: string | null,
): NotificationPrivacyLevel {
  const t = `${title} ${obligationType ?? ''}`.toLowerCase();
  if (
    t.includes('lab') ||
    t.includes('health') ||
    t.includes('medical') ||
    t.includes('diagnos')
  ) {
    return 'SENSITIVE';
  }
  if (t.includes('invoice') || t.includes('$') || t.includes('bank') || t.includes('tax')) {
    return 'SENSITIVE';
  }
  return 'REDACTED';
}

export async function syncNotificationFromMediation(args: {
  userId: string;
  mediationLogId: string;
  sourceEntityType: string;
  sourceEntityId: string;
  mediationDecision: MediationDecision;
  targetSurface: AssistantSurfaceType;
  reasonSummary: string | null;
  confidence: number;
  linkedObligationId: string | null;
}): Promise<void> {
  const {
    userId,
    mediationLogId,
    sourceEntityType,
    sourceEntityId,
    mediationDecision,
    targetSurface,
    reasonSummary,
    confidence,
    linkedObligationId,
  } = args;

  if (!phoneMediationAllowsNotification(mediationDecision, targetSurface)) {
    await recordPolicyDecision({
      userId,
      surface: NOTIFICATION_POLICY_SURFACE,
      outcome: PolicyOutcome.deny,
      reasonCodes: ['mediation_surface_not_eligible'],
      context: {
        mediationDecision,
        targetSurface,
        mediationLogId,
      },
      refEntityType: sourceEntityType,
      refEntityId: sourceEntityId,
    });
    return;
  }

  const [pref, settings, obligation] = await Promise.all([
    ensureNotificationUserPreference(userId),
    prisma.userSettings.findUnique({ where: { userId } }),
    linkedObligationId
      ? prisma.obligation.findFirst({ where: { id: linkedObligationId, userId } })
      : Promise.resolve(null),
  ]);

  if (obligation && (obligation.status === 'resolved' || obligation.status === 'dismissed')) {
    await recordPolicyDecision({
      userId,
      surface: NOTIFICATION_POLICY_SURFACE,
      outcome: PolicyOutcome.deny,
      reasonCodes: ['obligation_inactive'],
      context: { obligationStatus: obligation.status, linkedObligationId },
      refEntityType: sourceEntityType,
      refEntityId: sourceEntityId,
    });
    return;
  }

  const now = new Date();
  const fallbackSurfaceKind = sourceEntityType === 'Suggestion' ? 'CONTEXT_PREP' : 'DO_TODAY';
  const { urgencyLevel, notificationSurfaceKind: notificationType } = inferNotificationKindAndUrgency({
    linkedObligationDueAt: obligation?.dueAt ?? null,
    now,
    confidence,
    obligationType: obligation?.obligationType ?? null,
    fallbackSurfaceKind,
  });

  if (!categoryEnabled(notificationType, pref)) {
    await recordPolicyDecision({
      userId,
      surface: NOTIFICATION_POLICY_SURFACE,
      outcome: PolicyOutcome.deny,
      reasonCodes: ['category_disabled'],
      context: { notificationType },
      refEntityType: sourceEntityType,
      refEntityId: sourceEntityId,
    });
    return;
  }

  if (confidence < 0.35 && urgencyLevel !== 'CRITICAL' && mediationDecision !== 'escalate') {
    await recordPolicyDecision({
      userId,
      surface: NOTIFICATION_POLICY_SURFACE,
      outcome: PolicyOutcome.deny,
      reasonCodes: ['below_confidence_threshold'],
      context: { confidence, urgencyLevel, mediationDecision },
      refEntityType: sourceEntityType,
      refEntityId: sourceEntityId,
    });
    return;
  }

  const linkedEntityType = linkedObligationId ? 'Obligation' : sourceEntityType;
  const linkedEntityId = linkedObligationId ?? sourceEntityId;

  const title =
    obligation?.title?.trim() ||
    (sourceEntityType === 'Suggestion'
      ? (await prisma.suggestion.findFirst({ where: { id: sourceEntityId, userId } }))?.title
      : null) ||
    'Continuity item';

  const bodySummary = reasonSummary ?? obligation?.reasonSummary ?? null;
  const privacyLevel = heuristicPrivacy(title, obligation?.obligationType ?? null);

  const dedupeKey = `${linkedEntityType}:${linkedEntityId}:${notificationType}`;
  const dedupeSince = new Date(now.getTime() - DEDUPE_MS);
  const dup = await prisma.notificationSurfaceEvent.findFirst({
    where: {
      userId,
      dedupeKey,
      createdAt: { gte: dedupeSince },
      deliveryStatus: { in: ['PENDING', 'SENT', 'OPENED'] },
    },
  });
  if (dup) {
    await recordPolicyDecision({
      userId,
      surface: NOTIFICATION_POLICY_SURFACE,
      outcome: PolicyOutcome.deny,
      reasonCodes: ['dedupe_window_active'],
      context: { dedupeKey, duplicateNotificationId: dup.id },
      refEntityType: linkedEntityType,
      refEntityId: linkedEntityId,
    });
    return;
  }

  const tz = settings?.timezone ?? 'UTC';
  const quiet =
    pref.quietHoursEnabled &&
    isInsideQuietHours(now, tz, pref.quietHoursStart, pref.quietHoursEnd);
  const critical = urgencyLevel === 'CRITICAL' || mediationDecision === 'escalate';
  const allowDuringQuiet = critical && pref.criticalOverrideEnabled;

  let deliveryStatus: NotificationDeliveryStatus;
  let deliveryChannel: NotificationDeliveryChannel = NotificationDeliveryChannel.IN_APP;
  let sentAt: Date | null = null;

  if (quiet && !allowDuringQuiet) {
    deliveryStatus = 'PENDING';
  } else {
    deliveryStatus = 'SENT';
    sentAt = now;
    deliveryChannel = NotificationDeliveryChannel.LOCAL_PUSH;
  }

  const sourceSuggestionId = sourceEntityType === 'Suggestion' ? sourceEntityId : null;

  const created = await prisma.notificationSurfaceEvent.create({
    data: {
      userId,
      linkedEntityType,
      linkedEntityId,
      sourceSuggestionId,
      sourceMediationLogId: mediationLogId,
      notificationType,
      title,
      bodySummary,
      reasonSummary: reasonSummary ?? undefined,
      urgencyLevel,
      privacyLevel,
      deliveryChannel,
      deliveryStatus,
      sentAt,
      dedupeKey,
    },
  });

  const allowReasons = ['notification_surface_created'];
  if (quiet && !allowDuringQuiet) allowReasons.push('held_during_quiet_hours');
  else allowReasons.push('delivery_marked_sent');

  await recordPolicyDecision({
    userId,
    surface: NOTIFICATION_POLICY_SURFACE,
    outcome: PolicyOutcome.allow,
    reasonCodes: allowReasons,
    context: {
      notificationType,
      urgencyLevel,
      deliveryStatus,
      deliveryChannel,
      mediationDecision,
      quietHoursDeferred: quiet && !allowDuringQuiet,
    },
    refEntityType: linkedEntityType,
    refEntityId: linkedEntityId,
    notificationSurfaceEventId: created.id,
  });
}
