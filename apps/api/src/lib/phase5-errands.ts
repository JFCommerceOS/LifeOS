import type { Task } from '@prisma/client';
import { prisma } from '@life-os/database';

export type ErrandGroup = {
  locationHint: string;
  taskIds: string[];
  suggestedSequence: string[];
  tasks: Pick<Task, 'id' | 'title' | 'dueAt' | 'locationHint' | 'done'>[];
};

export type ErrandGroupsPayload = {
  groups: ErrandGroup[];
  ungroupedTaskIds: string[];
  note: string;
};

function sortTasksForSequence(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return a.title.localeCompare(b.title);
  });
}

/** Group open tasks by locationHint; suggest a practical order by due date. */
export async function buildErrandGroups(userId: string): Promise<ErrandGroupsPayload> {
  const open = await prisma.task.findMany({
    where: { userId, done: false },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  const withHint = open.filter((t) => (t.locationHint ?? '').trim().length > 0);
  const ungrouped = open.filter((t) => !(t.locationHint ?? '').trim());

  const byHint = new Map<string, Task[]>();
  for (const t of withHint) {
    const key = (t.locationHint ?? '').trim();
    const list = byHint.get(key) ?? [];
    list.push(t);
    byHint.set(key, list);
  }

  const groups: ErrandGroup[] = [];
  for (const [locationHint, tasks] of byHint) {
    const ordered = sortTasksForSequence(tasks);
    groups.push({
      locationHint,
      taskIds: ordered.map((x) => x.id),
      suggestedSequence: ordered.map((x) => x.title),
      tasks: ordered.map((x) => ({
        id: x.id,
        title: x.title,
        dueAt: x.dueAt,
        locationHint: x.locationHint,
        done: x.done,
      })),
    });
  }

  groups.sort((a, b) => a.locationHint.localeCompare(b.locationHint));

  const note =
    groups.length === 0
      ? 'Add a location hint to open tasks to group errands (same hint = same run).'
      : 'Groups combine tasks that share a location hint — order favors earlier due dates.';

  return {
    groups,
    ungroupedTaskIds: ungrouped.map((t) => t.id),
    note,
  };
}

export type ErrandWindowPayload = {
  preferredWindows: string[];
  rationale: string;
};

/** Lightweight action-window hint from profile reminder timing (not calendar-perfect). */
export async function buildErrandWindow(userId: string): Promise<ErrandWindowPayload> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const rt = profile?.reminderTiming ?? 'balanced';

  const map: Record<string, string[]> = {
    morning: ['Early day (morning block)', 'Before lunch'],
    afternoon: ['Midday window', 'Early afternoon'],
    evening: ['Late afternoon', 'Early evening'],
    balanced: ['Late morning', 'Mid-afternoon'],
  };

  return {
    preferredWindows: map[rt] ?? map.balanced,
    rationale:
      'Based on your reminder timing preference in Profile. Adjust Profile if these windows rarely work.',
  };
}
