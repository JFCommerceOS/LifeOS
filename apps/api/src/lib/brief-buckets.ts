export type ObligationBriefSource = {
  id: string;
  title: string;
  dueAt: Date | null;
};

/**
 * Partition open obligations for Daily Brief surfacing (Sprint 01 deterministic rules).
 * `nextEvent` is injected by the caller between do-now and do-today blocks.
 */
export function partitionObligationsForBrief(
  obligations: ObligationBriefSource[],
  now: Date,
  in7: Date,
): { doNow: ObligationBriefSource[]; doToday: ObligationBriefSource[]; watchWeek: ObligationBriefSource[] } {
  const doNow = obligations.slice(0, 3);
  const doToday = obligations.slice(3, 10);
  const usedObIds = new Set([...doNow, ...doToday].map((o) => o.id));
  const watchWeek = obligations
    .filter((o) => !usedObIds.has(o.id) && o.dueAt && o.dueAt > now && o.dueAt <= in7)
    .slice(0, 3);
  return { doNow, doToday, watchWeek };
}
