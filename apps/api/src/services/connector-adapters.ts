import type { ConnectorType } from '@prisma/client';
import type { SourceRecordKind } from '@prisma/client';

/** Normalized row from any adapter (provider-agnostic). */
export type AdapterFetchedItem = {
  externalId: string;
  sourceKind: SourceRecordKind;
  sourceUpdatedAt: Date;
  payload: Record<string, unknown>;
};

export type AdapterFetchResult = {
  items: AdapterFetchedItem[];
  nextCursor: Record<string, unknown>;
};

/** Stub calendar — deterministic sample events (no external API). */
function fetchStubCalendar(cursor: Record<string, unknown>): AdapterFetchResult {
  const start = new Date();
  start.setHours(start.getHours() + 2, 0, 0, 0);
  const end = new Date(start.getTime() + 3600000);
  return {
    items: [
      {
        externalId: 'stub-cal-sync-1',
        sourceKind: 'CALENDAR_EVENT',
        sourceUpdatedAt: new Date(),
        payload: {
          title: 'Connector sample: team sync',
          description: 'Prep: review deck (stub calendar item)',
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          location: 'Video call',
          organizer: 'you@local',
          attendees: ['Alex', 'Sam'],
          sourceEventId: 'stub-cal-sync-1',
        },
      },
    ],
    nextCursor: { ...(cursor ?? {}), v: 1 },
  };
}

function fetchStubTasks(cursor: Record<string, unknown>): AdapterFetchResult {
  const due = new Date(Date.now() + 86400000);
  return {
    items: [
      {
        externalId: 'stub-task-sync-1',
        sourceKind: 'TASK_RECORD',
        sourceUpdatedAt: new Date(),
        payload: {
          title: 'Connector sample: follow up on invoice',
          dueAt: due.toISOString(),
          status: 'open',
          listName: 'Work',
          priority: 'normal',
          sourceTaskId: 'stub-task-sync-1',
        },
      },
    ],
    nextCursor: { ...(cursor ?? {}), v: 1 },
  };
}

/** Weak evidence email thread — should stay low-trust / review-oriented. */
function fetchStubEmailMetadata(cursor: Record<string, unknown>): AdapterFetchResult {
  return {
    items: [
      {
        externalId: 'stub-email-sync-1',
        sourceKind: 'EMAIL_THREAD_METADATA',
        sourceUpdatedAt: new Date(),
        payload: {
          threadId: 'thr-1',
          subject: 'Re: contract question',
          from: 'vendor@example.com',
          to: ['you@local'],
          sentAt: new Date().toISOString(),
          snippetEnabled: false,
          evidenceStrength: 'weak',
        },
      },
    ],
    nextCursor: { ...(cursor ?? {}), v: 1 },
  };
}

export function fetchAdapterItems(
  connectorType: ConnectorType,
  cursorJson: string,
): AdapterFetchResult {
  let cursor: Record<string, unknown> = {};
  try {
    cursor = JSON.parse(cursorJson || '{}') as Record<string, unknown>;
  } catch {
    cursor = {};
  }

  switch (connectorType) {
    case 'CALENDAR':
      return fetchStubCalendar(cursor);
    case 'TASKS':
      return fetchStubTasks(cursor);
    case 'EMAIL_METADATA':
      return fetchStubEmailMetadata(cursor);
    default:
      return { items: [], nextCursor: cursor };
  }
}
