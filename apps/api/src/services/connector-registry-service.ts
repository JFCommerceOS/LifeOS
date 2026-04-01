import type { ConnectorPermissionKey, ConnectorType } from '@prisma/client';

/** Catalog entries for UI — no provider secrets. */
export type ConnectorCatalogEntry = {
  connectorType: ConnectorType;
  title: string;
  purpose: string;
  collects: string[];
  doesNotCollect: string[];
  defaultPermissions: ConnectorPermissionKey[];
};

const CATALOG: ConnectorCatalogEntry[] = [
  {
    connectorType: 'CALENDAR',
    title: 'Calendar',
    purpose: 'Surface upcoming events and improve “before next event” prep.',
    collects: ['title', 'start/end', 'location', 'organizer', 'attendee names', 'narrow description', 'source id', 'updated time'],
    doesNotCollect: ['broad attendee graph', 'meeting recordings', 'full comms analysis'],
    defaultPermissions: ['READ_EVENTS'],
  },
  {
    connectorType: 'TASKS',
    title: 'Tasks',
    purpose: 'Import due dates and status to reduce duplicate entry and improve brief ranking.',
    collects: ['title', 'due date', 'status', 'list/project', 'priority', 'source id', 'updated time'],
    doesNotCollect: ['auto-completing external tasks', 'writeback'],
    defaultPermissions: ['READ_TASKS'],
  },
  {
    connectorType: 'EMAIL_METADATA',
    title: 'Email metadata',
    purpose: 'Lightweight reply / review cues from headers and subject only (no full inbox by default).',
    collects: ['sender', 'recipients', 'subject', 'timestamps', 'thread id', 'labels when available'],
    doesNotCollect: ['full message bodies by default', 'attachments by default'],
    defaultPermissions: ['READ_EMAIL_METADATA'],
  },
  {
    connectorType: 'STUB',
    title: 'Development stub',
    purpose: 'Local testing without external APIs.',
    collects: ['synthetic sample rows'],
    doesNotCollect: ['real external data'],
    defaultPermissions: [],
  },
];

export function listConnectorCatalog(): ConnectorCatalogEntry[] {
  return CATALOG;
}

export function getCatalogEntry(t: ConnectorType): ConnectorCatalogEntry | undefined {
  return CATALOG.find((c) => c.connectorType === t);
}

export function defaultPermissionsForType(t: ConnectorType): ConnectorPermissionKey[] {
  return getCatalogEntry(t)?.defaultPermissions ?? [];
}
