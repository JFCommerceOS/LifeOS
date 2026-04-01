import type { ObligationBriefAdaptationPayload } from './brief-adaptation-i18n';

const base = '';

/** Optional session from Hardening Sprint 01 bootstrap (`localStorage`). */
const SESSION_KEY = 'life-os:session-token';

function sessionAuthHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem(SESSION_KEY);
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

/** Stable API error shape from Fastify (`apps/api/src/lib/errors.ts`). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...sessionAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let code = 'HTTP_ERROR';
    let message = text;
    try {
      const j = JSON.parse(text) as { error?: { code?: string; message?: string } };
      if (j?.error?.code) code = j.error.code;
      if (j?.error?.message) message = j.error.message;
    } catch {
      message = text;
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function apiMultipart<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    let code = 'HTTP_ERROR';
    let message = text;
    try {
      const j = JSON.parse(text) as { error?: { code?: string; message?: string } };
      if (j?.error?.code) code = j.error.code;
      if (j?.error?.message) message = j.error.message;
    } catch {
      message = text;
    }
    throw new ApiError(res.status, code, message);
  }
  return res.json() as Promise<T>;
}

export const lifeOsApi = {
  /** Local Ollama + A-S-FLC sidecar reachability (no secrets). */
  getHealthLlm: () =>
    api<{
      tier2: { enabled: boolean; ollamaReachable: boolean; model: string };
      tier1: { enabled: boolean; sidecarReachable: boolean };
    }>('/api/v1/health/llm'),
  getMe: () => api<{ user: { id: string; email: string | null } }>('/api/v1/auth/me'),
  /** Hardening Sprint 01 — stores token in localStorage for subsequent API calls. */
  postIdentityBootstrap: () =>
    api<{ user: unknown; sessionToken: string; sessionExpiresAt: string }>('/api/v1/identity/bootstrap', {
      method: 'POST',
      body: JSON.stringify({}),
    }).then((r) => {
      try {
        localStorage.setItem(SESSION_KEY, r.sessionToken);
      } catch {
        /* ignore */
      }
      return r;
    }),
  clearSessionToken: () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },
  getIdentityMe: () =>
    api<{
      user: unknown;
      activeSessionCount: number;
      security: unknown;
      edgeDevice: unknown;
    }>('/api/v1/identity/me'),
  getSessions: () => api<{ data: unknown[] }>('/api/v1/sessions'),
  postSessionsRevoke: (sessionId: string) =>
    api<{ ok: boolean }>('/api/v1/sessions/revoke', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }),
  getSecurityPolicyBundle: () =>
    api<{ settings: unknown; securityPolicies: unknown[] }>('/api/v1/policy'),
  patchSecurityPolicyBundle: (body: object) =>
    api<{ settings: unknown }>('/api/v1/policy', { method: 'PATCH', body: JSON.stringify(body) }),
  getPolicyDecisionLogs: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/policy/decision-logs?page=${page}`),
  postSecurityExport: (body: object) =>
    api<{ job: unknown }>('/api/v1/security/export', { method: 'POST', body: JSON.stringify(body) }),
  getSecurityExportJobs: () => api<{ data: unknown[]; meta: unknown }>('/api/v1/security/export-jobs'),
  getSecurityAuditLogs: () => api<{ data: unknown[]; meta: unknown }>('/api/v1/security/audit'),
  getDevices: () => api<{ data: unknown[] }>('/api/v1/devices'),
  patchDeviceTrust: (deviceId: string, body: object) =>
    api<{ device: unknown }>(`/api/v1/devices/${encodeURIComponent(deviceId)}/trust`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  postDeviceRevoke: (deviceId: string) =>
    api<{ ok: boolean }>(`/api/v1/devices/${encodeURIComponent(deviceId)}/revoke`, { method: 'POST' }),
  postDeviceRegister: (body: {
    clientDeviceId: string;
    label: string;
    role: 'phone' | 'watch' | 'accessory' | 'private_node';
  }) =>
    api<{ device: unknown }>('/api/v1/devices/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteDevice: (id: string) => api<void>(`/api/v1/devices/${id}`, { method: 'DELETE' }),
  getSyncStatus: () =>
    api<{
      paused: boolean;
      counts: Record<string, number>;
      lastSuccessfulApplyAt: string | null;
    }>('/api/v1/sync/status'),
  getSyncOutbox: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/sync/outbox?page=${page}`),
  postSyncRetry: (outboxId: string) =>
    api<{ ok: boolean }>(`/api/v1/sync/retry/${encodeURIComponent(outboxId)}`, { method: 'POST' }),
  postSyncPause: () => api<{ ok: boolean; paused: boolean }>('/api/v1/sync/pause', { method: 'POST' }),
  postSyncResume: () => api<{ ok: boolean; paused: boolean }>('/api/v1/sync/resume', { method: 'POST' }),
  getConflicts: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/conflicts?page=${page}`),
  getConflict: (conflictId: string) =>
    api<{ conflict: unknown }>(`/api/v1/conflicts/${encodeURIComponent(conflictId)}`),
  postConflictReview: (conflictId: string, body: object) =>
    api<{ conflict: unknown }>(`/api/v1/conflicts/${encodeURIComponent(conflictId)}/review`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getScheduledJobs: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/jobs?page=${page}`),
  getScheduledJob: (jobId: string) =>
    api<{ job: unknown }>(`/api/v1/jobs/${encodeURIComponent(jobId)}`),
  postScheduledJobRetry: (jobId: string) =>
    api<{ job: unknown }>(`/api/v1/jobs/${encodeURIComponent(jobId)}/retry`, { method: 'POST' }),
  getDiagnosticsTraces: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/diagnostics/traces?page=${page}`),
  getDiagnosticsExplanations: (entityType: string, entityId: string, page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(
      `/api/v1/diagnostics/explanations/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}?page=${page}`,
    ),
  getDiagnosticsProjections: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/diagnostics/projections?page=${page}`),
  postProjectionsRefresh: (body?: { projectionType?: string; triggerRef?: string }) =>
    api<{ projection: unknown; scheduledFor: string }>('/api/v1/projections/refresh', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  getSettings: () => api<{ settings: unknown }>('/api/v1/settings'),
  patchSettings: (body: object) =>
    api<{ settings: unknown }>('/api/v1/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  getLanguages: () => api<{ languages: unknown[] }>('/api/v1/languages'),
  getLanguage: (languageTag: string) =>
    api<{ language: unknown }>(`/api/v1/languages/${encodeURIComponent(languageTag)}`),
  getLanguageCapabilities: (languageTag: string) =>
    api<{ capabilities: unknown }>(`/api/v1/languages/${encodeURIComponent(languageTag)}/capabilities`),
  getLanguageSettings: () => api<{ preference: unknown }>('/api/v1/settings/language'),
  patchLanguageSettings: (body: object) =>
    api<{ preference: unknown }>('/api/v1/settings/language', { method: 'PATCH', body: JSON.stringify(body) }),
  getVoiceCapabilities: () =>
    api<{
      preference: unknown;
      stt: unknown;
      tts: unknown;
      speechPipelineNote: string;
    }>('/api/v1/voice/capabilities'),
  getVoiceVoices: () => api<{ voices: unknown[] }>('/api/v1/voice/voices'),
  postVoiceTestStt: (body?: { languageTag?: string; audioBase64?: string }) =>
    api<{
      ok: boolean;
      languageTag: string;
      provider: string;
      transcript: string;
      note: string;
    }>('/api/v1/voice/test-stt', { method: 'POST', body: JSON.stringify(body ?? {}) }),
  postVoiceTestTts: (body: { text: string; languageTag?: string }) =>
    api<{
      ok: boolean;
      languageTag: string;
      provider: string;
      audioBase64: null;
      durationMs: null;
      note: string;
    }>('/api/v1/voice/test-tts', { method: 'POST', body: JSON.stringify(body) }),
  getPrivacy: () => api<Record<string, unknown>>('/api/v1/privacy'),
  patchPrivacy: (body: object) =>
    api<Record<string, unknown>>('/api/v1/privacy', { method: 'PATCH', body: JSON.stringify(body) }),
  getPrivacyInventory: () =>
    api<{
      categories: {
        category: string;
        count: number;
        sensitivityLevel: string;
        retentionClass: string;
        sourceTypes: string[];
        notes: string;
      }[];
      generatedAt: string;
    }>('/api/v1/privacy/inventory'),
  getPrivacyPolicies: () => api<{ policies: unknown[] }>('/api/v1/privacy/policies'),
  patchPrivacyPolicy: (policyId: string, body: object) =>
    api<{ policy: unknown }>(`/api/v1/privacy/policies/${encodeURIComponent(policyId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getPrivacyActions: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/privacy/actions?page=${page}`),
  postPrivacyAction: (body: {
    actionType: string;
    targetEntityType: string;
    targetEntityId?: string | null;
    reason?: string | null;
    execute?: boolean;
  }) =>
    api<unknown>('/api/v1/privacy/actions', { method: 'POST', body: JSON.stringify(body) }),
  getPrivacyLineage: (entityType: string, entityId: string) =>
    api<{ lineage: unknown }>(
      `/api/v1/privacy/lineage?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
    ),
  postExportJob: (body?: { exportScope?: string; includeSensitive?: boolean; format?: 'json' | 'markdown' }) =>
    api<{ job: unknown }>('/api/v1/exports', { method: 'POST', body: JSON.stringify(body ?? {}) }),
  getExportJobs: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/exports?page=${page}`),
  getExportJob: (exportId: string) => api<{ job: unknown }>(`/api/v1/exports/${encodeURIComponent(exportId)}`),
  postPurgeJob: (body: {
    scopeType: 'connector' | 'category';
    scopeId?: string | null;
    category?: string;
    executionMode: string;
  }) => api<{ job: unknown }>('/api/v1/purge', { method: 'POST', body: JSON.stringify(body) }),
  getPurgeJobs: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/purge/jobs?page=${page}`),
  getConnectorDataSummary: (id: string) =>
    api<Record<string, unknown>>(`/api/v1/connectors/${encodeURIComponent(id)}/data-summary`),
  getConnectorCatalog: () => api<{ catalog: unknown[] }>('/api/v1/connectors/catalog'),
  getConnectors: () => api<{ connectors: unknown[] }>('/api/v1/connectors'),
  getConnector: (id: string) =>
    api<{ connector: unknown; recentRuns: unknown[] }>(`/api/v1/connectors/${encodeURIComponent(id)}`),
  postConnector: (body: {
    connectorType: 'CALENDAR' | 'TASKS' | 'EMAIL_METADATA' | 'STUB';
    name: string;
    configJson?: string;
    enabled?: boolean;
  }) => api<{ connector: unknown }>('/api/v1/connectors', { method: 'POST', body: JSON.stringify(body) }),
  patchConnector: (id: string, body: object) =>
    api<{ connector: unknown }>(`/api/v1/connectors/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  postConnectorConnect: (id: string) =>
    api<{ connector: unknown }>(`/api/v1/connectors/${encodeURIComponent(id)}/connect`, { method: 'POST' }),
  postConnectorPause: (id: string) =>
    api<{ connector: unknown }>(`/api/v1/connectors/${encodeURIComponent(id)}/pause`, { method: 'POST' }),
  postConnectorResume: (id: string) =>
    api<{ connector: unknown }>(`/api/v1/connectors/${encodeURIComponent(id)}/resume`, { method: 'POST' }),
  postConnectorDisconnect: (id: string) =>
    api<{ connector: unknown }>(`/api/v1/connectors/${encodeURIComponent(id)}/disconnect`, { method: 'POST' }),
  postConnectorSync: (id: string) =>
    api<{
      runId: string;
      recordsSeen: number;
      recordsInserted: number;
      recordsUpdated: number;
      recordsFailed: number;
    }>(`/api/v1/connectors/${encodeURIComponent(id)}/sync`, { method: 'POST' }),
  postConnectorResync: (id: string) =>
    api<{
      runId: string;
      recordsSeen: number;
      recordsInserted: number;
      recordsUpdated: number;
      recordsFailed: number;
    }>(`/api/v1/connectors/${encodeURIComponent(id)}/resync`, { method: 'POST' }),
  postConnectorPurge: (id: string) =>
    api<{ affectedRecordCount: number }>(`/api/v1/connectors/${encodeURIComponent(id)}/purge`, {
      method: 'POST',
    }),
  getConnectorRuns: (id: string, page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(
      `/api/v1/connectors/${encodeURIComponent(id)}/runs?page=${page}`,
    ),
  getConnectorRun: (connectorId: string, runId: string) =>
    api<{ run: unknown }>(
      `/api/v1/connectors/${encodeURIComponent(connectorId)}/runs/${encodeURIComponent(runId)}`,
    ),
  getNotes: (page = 1) => api<{ data: unknown[]; meta: unknown }>(`/api/v1/notes?page=${page}`),
  postNote: (body: { body: string; title?: string }) =>
    api<{
      note: { id: string };
      signal: { id: string; processingStatus: string; signalType: string };
      normalized: { normalizedText: string } | null;
      facts: { id: string; factType: string; confidence: number }[];
      obligations: { id: string; title: string; reasonSummary: string | null; evidenceCount: number }[];
    }>('/api/v1/notes', { method: 'POST', body: JSON.stringify(body) }),
  getEvents: (page = 1) => api<{ data: unknown[]; meta: unknown }>(`/api/v1/events?page=${page}`),
  postEvent: (body: {
    title: string;
    description?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
  }) =>
    api<{
      event: { id: string };
      signal: { id: string; processingStatus: string };
      facts: unknown[];
      obligations: unknown[];
    }>('/api/v1/events', { method: 'POST', body: JSON.stringify(body) }),
  getEvent: (id: string) => api<{ event: unknown }>(`/api/v1/events/${id}`),
  getPersons: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/persons?page=${page}`),
  postPerson: (body: { name: string; relationshipType?: string; importance?: number }) =>
    api<{ person: unknown }>('/api/v1/persons', { method: 'POST', body: JSON.stringify(body) }),
  getPerson: (id: string) => api<{ person: unknown }>(`/api/v1/persons/${id}`),
  patchPerson: (id: string, body: object) =>
    api<{ person: unknown }>(`/api/v1/persons/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getContextPersonCard: (id: string) =>
    api<{
      person: unknown;
      openObligations: unknown[];
      linkedNotes: unknown[];
      conversations: unknown[];
    }>(`/api/v1/context/persons/${id}/card`),
  getContextEventBrief: (id: string) =>
    api<{
      event: unknown;
      participants: unknown[];
      priorNotes: unknown[];
      relatedDocuments?: unknown[];
      openObligations: unknown[];
      lastDiscussed: unknown | null;
      prepSummary: string;
    }>(`/api/v1/context/events/${id}/brief`),
  getContextPersonDetail: (id: string) =>
    api<{
      person: unknown;
      openObligations: unknown[];
      linkedNotes: unknown[];
      conversations: unknown[];
      contextObject: unknown | null;
    }>(`/api/v1/context/person/${encodeURIComponent(id)}`),
  getPrepEvent: (eventId: string) =>
    api<{
      prep: Record<string, unknown>;
      event: unknown;
      bundle: unknown | null;
    }>(`/api/v1/prep/events/${encodeURIComponent(eventId)}`),
  postPrepRecomputeEvent: (eventId: string) =>
    api<Record<string, unknown>>(`/api/v1/prep/events/${encodeURIComponent(eventId)}/recompute`, {
      method: 'POST',
      body: '{}',
    }),
  getContextNextEvent: () => api<{ event: unknown | null }>('/api/v1/context/next-event'),
  postEntityLink: (body: {
    fromEntityType: string;
    fromEntityId: string;
    toEntityType: string;
    toEntityId: string;
    relationType: string;
    confidence?: number;
    reasonSummary?: string;
  }) =>
    api<{ link: unknown }>('/api/v1/entity-links', { method: 'POST', body: JSON.stringify(body) }),
  postPersonCorrect: (id: string, body: { correctionType: string; correctionNote?: string }) =>
    api<{ correction: unknown }>(`/api/v1/persons/${encodeURIComponent(id)}/correct`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getObligations: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/obligations?page=${page}`),
  patchObligation: (
    id: string,
    body: {
      action?: 'confirm' | 'dismiss' | 'resolve' | 'reopen';
      status?: string;
      note?: string;
      title?: string;
      dueAt?: string | null;
      description?: string | null;
    },
  ) =>
    api<{ obligation: unknown; continuity?: Record<string, unknown> }>(`/api/v1/obligations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getObligation: (id: string) =>
    api<{ obligation: unknown; evidenceCount: number; sourceEntity: unknown }>(
      `/api/v1/obligations/${encodeURIComponent(id)}`,
    ),
  getSuggestions: (page = 1, includeAdaptation = false) =>
    api<{ data: unknown[]; meta: unknown }>(
      `/api/v1/suggestions?page=${page}${includeAdaptation ? '&includeAdaptation=true' : ''}`,
    ),
  postSuggestionAction: (
    id: string,
    body: {
      action: string;
      note?: string;
      snoozeUntil?: string;
      surface?: 'DAILY_BRIEF' | 'OBLIGATIONS' | 'EVENT_DETAIL' | 'MEMORY_INSPECTOR';
    },
  ) =>
    api<{ suggestion: unknown; feedbackSignal?: unknown }>(`/api/v1/suggestions/${id}/action`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getLatestBrief: (companion?: boolean) =>
    api<{ brief: unknown | null }>(
      `/api/v1/briefs/daily/latest${companion ? '?companion=true' : ''}`,
    ),
  getTodayBrief: (opts?: { explainAdaptation?: boolean }) =>
    api<{
      brief: unknown | null;
      day?: string;
      continuityHints?: unknown[];
      activeModeBanner?: { mode: string; source: string };
      /** Localized on the client from structured fields */
      adaptationExplanationByItemId?: Record<string, ObligationBriefAdaptationPayload>;
    }>(
      `/api/v1/briefs/today${opts?.explainAdaptation ? '?explainAdaptation=true' : ''}`,
    ),
  /** Optional local LLM (Ollama). When disabled, API returns 200 with `enabled: false`. */
  postBriefItemExplain: (itemId: string) =>
    api<
      | {
          enabled: true;
          explanation: string;
          model?: string;
          latencyMs?: number;
          promptHash?: string;
          itemId?: string;
        }
      | { enabled: false; explanation: null; message?: string }
    >(`/api/v1/briefs/items/${encodeURIComponent(itemId)}/explain`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  postFeedback: (
    body:
      | {
          linkedEntityType: 'SUGGESTION' | 'OBLIGATION' | 'MEMORY_NODE';
          linkedEntityId: string;
          feedbackType: 'CONFIRM' | 'DISMISS' | 'RESOLVE' | 'CORRECT' | 'FALSE_POSITIVE';
          note?: string;
          surface?: 'DAILY_BRIEF' | 'OBLIGATIONS' | 'EVENT_DETAIL' | 'MEMORY_INSPECTOR';
          correctionNote?: string;
          correctedFields?: { summary?: string; confidence?: number };
        }
      | { suggestionId?: string; useful?: boolean; note?: string },
  ) =>
    api<{
      signal: unknown;
      targetSummary?: Record<string, unknown>;
      continuityEffect?: Record<string, unknown>;
    }>('/api/v1/feedback', { method: 'POST', body: JSON.stringify(body) }),
  postMemoryCorrection: (body: object) =>
    api<{ correction: unknown }>('/api/v1/memory-corrections', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getCompanionGlance: () =>
    api<{
      date: string;
      topObligations: { id: string; title: string; dueAt: string | null }[];
      briefSnippet: string;
    }>('/api/v1/companion/glance'),

  getAdminSummary: () =>
    api<{
      upcomingRenewals: unknown[];
      returnWindowsClosing: unknown[];
      adminActiveCount?: number;
    }>('/api/v1/admin/summary'),
  getAdminOverview: () =>
    api<{
      active: unknown[];
      dueSoon: unknown[];
      receipts: unknown[];
    }>('/api/v1/admin/overview'),
  getAdminRecords: (page = 1, status?: string) =>
    api<{ data: unknown[]; meta: unknown }>(
      `/api/v1/admin?page=${page}${status ? `&status=${encodeURIComponent(status)}` : ''}`,
    ),
  getAdminRecord: (id: string) =>
    api<{ record: unknown; obligation: unknown | null }>(`/api/v1/admin/${encodeURIComponent(id)}`),
  patchAdminRecord: (id: string, body: object) =>
    api<{ record: unknown }>(`/api/v1/admin/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  postAdminMarkPaid: (id: string, body?: { note?: string }) =>
    api<{ ok: boolean; record: unknown }>(`/api/v1/admin/${encodeURIComponent(id)}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  postAdminComplete: (id: string, body?: { note?: string }) =>
    api<{ ok: boolean; record: unknown }>(`/api/v1/admin/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  postAdminSnooze: (id: string, body: { snoozeUntil: string; note?: string }) =>
    api<{ ok: boolean; record: unknown }>(`/api/v1/admin/${encodeURIComponent(id)}/snooze`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  postAdminArchive: (id: string, body?: { note?: string }) =>
    api<{ ok: boolean; record: unknown }>(`/api/v1/admin/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  postAdminDismiss: (id: string, body?: { note?: string }) =>
    api<{ ok: boolean; record: unknown }>(`/api/v1/admin/${encodeURIComponent(id)}/dismiss`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  postAdminCorrect: (id: string, body?: { title?: string; dueAt?: string | null; amountValue?: number | null; note?: string }) =>
    api<{ record: unknown }>(`/api/v1/admin/${encodeURIComponent(id)}/correct`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  getPurchases: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/purchases?page=${page}`),
  postPurchase: (body: object) =>
    api<{ purchase: unknown }>('/api/v1/purchases', { method: 'POST', body: JSON.stringify(body) }),
  getSubscriptions: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/subscriptions?page=${page}`),
  postSubscription: (body: object) =>
    api<{ subscription: unknown }>('/api/v1/subscriptions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getLifeAppointments: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/life-appointments?page=${page}`),
  postLifeAppointment: (body: object) =>
    api<{ appointment: unknown }>('/api/v1/life-appointments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getProfile: () => api<{ profile: unknown }>('/api/v1/profile'),
  patchProfile: (body: object) =>
    api<{ profile: unknown }>('/api/v1/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  postProfileRecompute: () =>
    api<{ profile: unknown }>('/api/v1/profile/recompute', { method: 'POST', body: '{}' }),
  postProfileResetInference: () =>
    api<{ clearedSignals: number; clearedStates: number }>('/api/v1/profile/reset-inference', {
      method: 'POST',
      body: '{}',
    }),
  getProfileMode: () =>
    api<{ mode: string; source: string; endsAt: string | null }>('/api/v1/profile/mode'),
  postProfileMode: (body: { activeMode: string; durationHours?: number }) =>
    api<{ id: string }>('/api/v1/profile/mode', { method: 'POST', body: JSON.stringify(body) }),
  postProfileModeClear: () => api<{ ok: boolean }>('/api/v1/profile/mode/clear', { method: 'POST', body: '{}' }),
  getProfileAdaptationState: () => api<Record<string, unknown>>('/api/v1/profile/adaptation-state'),
  getProfileAdaptationLogs: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/profile/adaptation-logs?page=${page}`),
  postProfilePreferenceCorrect: (body: { preferenceKey: string; valueJson: Record<string, unknown>; note?: string }) =>
    api<{ state: unknown }>('/api/v1/profile/preference-correct', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  postVoiceCapture: (body: { transcript: string; title?: string; audioStorageKey?: string }) =>
    api<{ capture: unknown; note: unknown }>('/api/v1/voice/capture', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Sprint 12 — multipart field `audio` (blob), optional fields `durationMs`, `sourceDevice`. */
  postVoiceCaptureUpload: (formData: FormData) =>
    apiMultipart<{ capture: unknown; transcribe: { needsReview: boolean; transcriptionStatus: string } }>(
      '/api/v1/voice-captures',
      formData,
    ),
  confirmVoiceCaptureTranscript: (id: string) =>
    api<{ capture: unknown; weak: boolean }>(`/api/v1/voice-captures/${encodeURIComponent(id)}/confirm-transcript`, {
      method: 'POST',
      body: '{}',
    }),
  correctVoiceCaptureTranscript: (id: string, body: { transcript: string }) =>
    api<{ capture: unknown }>(`/api/v1/voice-captures/${encodeURIComponent(id)}/correct-transcript`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  postBriefTodayReadout: () =>
    api<{ enabled: boolean; text: string; audioBase64: null; note?: string }>('/api/v1/briefs/today/readout', {
      method: 'POST',
      body: '{}',
    }),
  postSuggestionReadout: (id: string) =>
    api<{ enabled: boolean; text: string; audioBase64: null; note?: string }>(
      `/api/v1/suggestions/${encodeURIComponent(id)}/readout`,
      { method: 'POST', body: '{}' },
    ),
  getReminders: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/reminders?page=${page}`),

  getPlaceEvents: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/place-events?page=${page}`),
  postPlaceEvent: (body: object) =>
    api<{ placeEvent: unknown }>('/api/v1/place-events', { method: 'POST', body: JSON.stringify(body) }),
  deletePlaceEvent: (id: string) =>
    api<void>(`/api/v1/place-events/${id}`, { method: 'DELETE' }),

  getPlacesCapabilities: () =>
    api<{
      mode: string;
      backgroundTracking: boolean;
      rawTrailStorage: boolean;
      locationIntelligenceOptIn: boolean;
      patternSignalsOptIn: boolean;
      note?: string;
    }>('/api/v1/places/capabilities'),
  getSavedPlaces: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/places?page=${page}`),
  getSavedPlace: (id: string) => api<{ place: unknown }>(`/api/v1/places/${encodeURIComponent(id)}`),
  postSavedPlace: (body: {
    label: string;
    category?: string;
    sensitivity?: string;
    defaultMasked?: boolean;
    notes?: string;
    aliases?: string[];
  }) => api<{ place: unknown }>('/api/v1/places', { method: 'POST', body: JSON.stringify(body) }),
  patchSavedPlace: (id: string, body: object) =>
    api<{ place: unknown }>(`/api/v1/places/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteSavedPlace: (id: string) =>
    api<void>(`/api/v1/places/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  postSavedPlaceAlias: (placeId: string, body: { alias: string }) =>
    api<{ alias: unknown }>(`/api/v1/places/${encodeURIComponent(placeId)}/aliases`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteSavedPlaceAlias: (placeId: string, aliasId: string) =>
    api<void>(
      `/api/v1/places/${encodeURIComponent(placeId)}/aliases/${encodeURIComponent(aliasId)}`,
      { method: 'DELETE' },
    ),

  postScreenTimeSummary: (body: object) =>
    api<{ screenTimeSummary: unknown }>('/api/v1/screen-time-summaries', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getScreenTimeSummaries: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/screen-time-summaries?page=${page}`),
  getInsightsPatterns: () =>
    api<{
      optIn: boolean;
      bullets: string[];
      poorReminderWindows: string[];
      nearPlaceHints: string[];
    }>('/api/v1/insights/patterns'),
  getInsightsFinancial: () =>
    api<{ duplicateSpendHints: string[]; subscriptionSignals: string[] }>(
      '/api/v1/insights/financial',
    ),
  getInsightsLifestyle: () =>
    api<{
      optIn: boolean;
      disclaimer: string;
      workloadHints: string[];
      balanceHints: string[];
      diningActivityHints: string[];
    }>('/api/v1/insights/lifestyle'),
  getInsightsRoutine: () =>
    api<{
      optIn: boolean;
      disclaimer: string;
      consistencyHints: string[];
      driftHints: string[];
    }>('/api/v1/insights/routine'),
  getDecisions: (page = 1) =>
    api<{ data: unknown[]; meta: unknown }>(`/api/v1/decisions?page=${page}`),
  postDecision: (body: {
    title: string;
    rationale?: string;
    outcomeNote?: string;
    decidedAt?: string;
    topicKey?: string;
  }) =>
    api<{ decision: unknown; similarPrior: unknown[] }>('/api/v1/decisions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchDecision: (id: string, body: object) =>
    api<{ decision: unknown; similarPrior: unknown[] }>(`/api/v1/decisions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteDecision: (id: string) => api<void>(`/api/v1/decisions/${id}`, { method: 'DELETE' }),
  getTasks: (page = 1) => api<{ data: unknown[]; meta: unknown }>(`/api/v1/tasks?page=${page}`),
  postTask: (body: {
    title: string;
    done?: boolean;
    dueAt?: string | null;
    locationHint?: string | null;
  }) =>
    api<{
      task: { id: string };
      signal: { id: string; processingStatus: string };
      facts: unknown[];
      obligations: unknown[];
    }>('/api/v1/tasks', { method: 'POST', body: JSON.stringify(body) }),
  getErrandsGroups: () =>
    api<{
      groups: {
        locationHint: string;
        taskIds: string[];
        suggestedSequence: string[];
        tasks: unknown[];
      }[];
      ungroupedTaskIds: string[];
      note: string;
    }>('/api/v1/errands/groups'),
  getErrandsWindow: () =>
    api<{ preferredWindows: string[]; rationale: string }>('/api/v1/errands/window'),
  getDigitalTwin: () =>
    api<{
      predictiveMode: boolean;
      disclaimer: string;
      explicit: { key: string; label: string; value: string; source: string }[];
      inferred: unknown[];
      disabledInferenceKeys: string[];
    }>('/api/v1/digital-twin'),
  patchDigitalTwin: (body: {
    traitCorrections?: Record<string, { note?: string; overrideSummary?: string }>;
    disabledInferenceKeys?: string[];
  }) =>
    api<{ profile: unknown; twin: unknown }>('/api/v1/digital-twin', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  postDigitalTwinPurge: (body: { scope: 'all' | 'corrections' | 'visibility' }) =>
    api<{ profile: unknown; twin: unknown }>('/api/v1/digital-twin/purge', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getPlanningAdaptive: () =>
    api<{
      enabled: boolean;
      disclaimer: string;
      cards: {
        id: string;
        title: string;
        rationale: string;
        confidence: number;
        influencingFactors: string[];
        timingNote: string;
      }[];
    }>('/api/v1/planning/adaptive'),
  getEcosystemManifest: () => api<Record<string, unknown>>('/api/v1/ecosystem/manifest'),
  getCompanionWatch: () =>
    api<{
      surface: 'watch';
      dueNow: { id: string; title: string; dueAt: string | null } | null;
      suggestion: { id: string; title: string; oneLine: string } | null;
      pendingSuggestions: number;
      briefLine: string;
    }>('/api/v1/companion/watch'),
  getTileCurrent: () =>
    api<{
      mode: string;
      primaryHeadline: string;
      primarySubline?: string;
      secondaryHeadline?: string;
      secondarySubline?: string;
      urgencyLevel: string;
      privacyClass: string;
      actionHint: string;
      lastUpdatedAt: string;
      ref?: {
        obligationId?: string;
        eventId?: string;
        suggestionId?: string;
        subscriptionId?: string;
      };
    }>('/api/v1/surfaces/tile/current'),
  getTileModes: () =>
    api<{ supported: string[]; effectiveMode: string; manualOverride: string | null }>(
      '/api/v1/surfaces/tile/modes',
    ),
  getPermissionPurposeCatalog: () =>
    api<{
      entries: {
        capabilityKey: string;
        purposeLabel: string;
        explanationTemplate: string;
        dataSourcesRequired: string[];
        permissionScopeRequired: string[];
        defaultAllowedBehaviors: string[];
        defaultBlockedBehaviors: string[];
      }[];
    }>('/api/v1/permissions/purpose-catalog'),
  getCapabilities: () =>
    api<{ capabilities: Record<string, unknown>[] }>('/api/v1/capabilities'),
  getCapabilityOnboardingHints: () =>
    api<{ hints: { capabilityKey: string; purposeLabel: string; purposeCopy: string }[] }>(
      '/api/v1/capabilities/onboarding/hints',
    ),
  patchCapabilityState: (capabilityKey: string, body: { runtimeState: string; reasonSummary?: string }) =>
    api<{ registry: Record<string, unknown> }>(`/api/v1/capabilities/${encodeURIComponent(capabilityKey)}/state`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getDomainsCatalog: () => api<{ domains: Record<string, unknown>[] }>('/api/v1/domains'),
  getDomainsProfile: () => api<{ profile: Record<string, unknown>[] }>('/api/v1/domains/profile'),
  getDomainProfileDetail: (domainKey: string) =>
    api<Record<string, unknown>>(`/api/v1/domains/profile/${encodeURIComponent(domainKey)}`),
  patchDomainProfile: (
    domainKey: string,
    body: {
      runtimeState?: string;
      activationStrength?: string;
      confidence?: number;
      reasonSummary?: string;
    },
  ) =>
    api<{ profile: Record<string, unknown> }>(`/api/v1/domains/profile/${encodeURIComponent(domainKey)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getDomainAdaptationUi: () => api<{ ui: Record<string, unknown> }>('/api/v1/domains/adaptation/ui'),
  getDomainAdaptationTone: () => api<{ tone: Record<string, unknown> }>('/api/v1/domains/adaptation/tone'),

  getUserStateCurrent: () =>
    api<{ snapshot: Record<string, unknown> | null }>('/api/v1/user-state/current'),
  postUserStateRefresh: () =>
    api<{ snapshot: Record<string, unknown> }>('/api/v1/user-state/refresh', { method: 'POST', body: '{}' }),
  /** Same JSON as `GET /api/v1/surfaces/policies` (blueprint path). */
  getSurfacePolicies: () =>
    api<{ policies: Record<string, unknown>[] }>('/api/v1/surfaces/policies'),
  patchSurfacePolicy: (id: string, body: Record<string, unknown>) =>
    api<{ policy: Record<string, unknown> }>(`/api/v1/surface-policies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getMediationLogs: (limit = 20) =>
    api<{ logs: Record<string, unknown>[] }>(`/api/v1/assistant/mediation-logs?limit=${limit}`),
  getMediationDecision: (logId: string) =>
    api<{ decision: Record<string, unknown> }>(
      `/api/v1/assistant/mediation-logs/${encodeURIComponent(logId)}`,
    ),
  postAssistantMediate: (body: {
    sourceEntityType: string;
    sourceEntityId: string;
    rank: number;
    confidence: number;
    trustScore?: number;
    sensitivityClass?: 'safe' | 'moderate' | 'high' | 'very_high';
    dismissCount?: number;
  }) =>
    api<{
      mediationDecision: string;
      targetSurface: string;
      reasonSummary: string | null;
      confidence: number;
      logId: string;
    }>('/api/v1/assistant/mediate', { method: 'POST', body: JSON.stringify(body) }),

  getMemory: (page = 1) =>
    api<{ data: Record<string, unknown>[]; meta: unknown }>(`/api/v1/memory?page=${page}`),
  getMemoryNode: (id: string) =>
    api<{ node: Record<string, unknown>; lineage?: Record<string, unknown> }>(
      `/api/v1/memory/${encodeURIComponent(id)}`,
    ),
  postMemoryConfirm: (body: { memoryNodeId: string; confirmed: boolean }) =>
    api<{ confirmation: unknown }>('/api/v1/memory/confirm', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  postMemoryCorrect: (body: {
    memoryNodeId: string;
    correctionNote: string;
    newSummary?: string;
    correctedFields?: { summary?: string; confidence?: number };
  }) => api<{ ok: boolean }>('/api/v1/memory/correct', { method: 'POST', body: JSON.stringify(body) }),
  postMemoryArchive: (body: { memoryNodeId: string; reason?: string }) =>
    api<{ ok: boolean }>('/api/v1/memory/archive', { method: 'POST', body: JSON.stringify(body) }),
  deleteMemoryNode: (id: string) =>
    api<void>(`/api/v1/memory/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getDocuments: (page = 1, status?: string) =>
    api<{ data: unknown[]; meta: unknown }>(
      `/api/v1/documents?page=${page}${status ? `&status=${encodeURIComponent(status)}` : ''}`,
    ),
  getDocument: (id: string) =>
    api<{ document: Record<string, unknown> }>(`/api/v1/documents/${encodeURIComponent(id)}`),
  postDocumentUpload: (formData: FormData) =>
    apiMultipart<{ documentId: string; status: string }>('/api/v1/documents/upload', formData),
  postDocumentCaptureUpload: (formData: FormData) =>
    apiMultipart<{ documentId: string; status: string }>('/api/v1/documents/capture-upload', formData),
  patchDocument: (id: string, body: Record<string, unknown>) =>
    api<{ document: Record<string, unknown> }>(`/api/v1/documents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  postDocumentFeedback: (
    id: string,
    body: { feedbackType: string; fieldName?: string | null; note?: string | null },
  ) =>
    api<{ feedback: Record<string, unknown> }>(`/api/v1/documents/${encodeURIComponent(id)}/feedback`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  postTileAction: (body: {
    action: 'acknowledge' | 'snooze' | 'cycle_mode' | 'open_on_phone' | 'clear_manual_mode';
    suggestionId?: string;
  }) =>
    api<{
      ok?: boolean;
      tile?: unknown;
      nextMode?: string;
      handoff?: string;
    }>('/api/v1/surfaces/tile/action', { method: 'POST', body: JSON.stringify(body) }),

  getNotificationPreferences: () =>
    api<{ preferences: Record<string, unknown> }>('/api/v1/notifications/preferences'),
  patchNotificationPreferences: (body: Record<string, unknown>) =>
    api<{ preferences: Record<string, unknown> }>('/api/v1/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getNotifications: (page = 1) =>
    api<{ data: Record<string, unknown>[]; meta: unknown }>(`/api/v1/notifications?page=${page}`),
  getNotification: (id: string) =>
    api<{ notification: Record<string, unknown> }>(`/api/v1/notifications/${encodeURIComponent(id)}`),
  postNotificationAction: (
    id: string,
    body: { action: string; note?: string; snoozeMinutes?: number },
  ) =>
    api<{ ok: boolean }>(`/api/v1/notifications/${encodeURIComponent(id)}/action`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getMobileBriefToday: () => api<Record<string, unknown>>('/api/v1/mobile/briefs/today'),
  getMobileBriefSection: (bucket: string) =>
    api<{ bucket: string; items: unknown[] }>(
      `/api/v1/mobile/briefs/section/${encodeURIComponent(bucket)}`,
    ),

  postMobileCaptureNote: (body: { body: string; title?: string }) =>
    api<unknown>('/api/v1/mobile/capture/note', { method: 'POST', body: JSON.stringify(body) }),
  postMobileCaptureTask: (body: { title: string; done?: boolean; dueAt?: string | null }) =>
    api<unknown>('/api/v1/mobile/capture/task', { method: 'POST', body: JSON.stringify(body) }),
  postMobileCaptureEvent: (body: {
    title: string;
    description?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
  }) => api<unknown>('/api/v1/mobile/capture/event', { method: 'POST', body: JSON.stringify(body) }),
  postMobileCaptureDocument: (formData: FormData) =>
    apiMultipart<unknown>('/api/v1/mobile/capture/document', formData),

  patchDevice: (id: string, body: Record<string, unknown>) =>
    api<{ device: Record<string, unknown> }>(`/api/v1/devices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
