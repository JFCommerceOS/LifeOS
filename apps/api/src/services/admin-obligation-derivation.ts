import { prisma } from '@life-os/database';

const NEAR_MS = 21 * 86400000;
const MIN_CONF = 0.48;

/** Create obligation only when evidence is strong enough and deadline is near. */
export async function ensureObligationForAdminRecord(userId: string, adminRecordId: string) {
  const r = await prisma.adminRecord.findFirst({ where: { id: adminRecordId, userId } });
  if (!r || r.status !== 'ACTIVE') return null;
  if (r.extractionConfidence < MIN_CONF) return null;

  const due = r.dueAt ?? r.renewsAt ?? r.returnWindowEndsAt ?? r.appointmentAt;
  if (!due) return null;
  const now = Date.now();
  if (due.getTime() - now > NEAR_MS) return null;

  const existing = await prisma.obligation.findFirst({
    where: {
      userId,
      sourceEntityType: 'AdminRecord',
      sourceEntityId: adminRecordId,
      status: { in: ['open', 'confirmed', 'reopened'] },
    },
  });
  if (existing) return existing;

  const label =
    r.adminType === 'RENEWAL' || r.adminType === 'SUBSCRIPTION'
      ? `Renew: ${r.title.slice(0, 90)}`
      : r.adminType === 'RETURN_WINDOW' || r.adminType === 'RECEIPT'
        ? `Return / admin: ${r.title.slice(0, 90)}`
        : `Admin: ${r.title.slice(0, 90)}`;

  return prisma.obligation.create({
    data: {
      userId,
      title: label,
      status: 'open',
      dueAt: due,
      obligationType: 'TASK_DEADLINE',
      reasonSummary: (r.reasonSummary || `Admin Guard (${r.adminType})`).slice(0, 500),
      confidence: Math.min(0.9, r.extractionConfidence),
      sourceEntityType: 'AdminRecord',
      sourceEntityId: adminRecordId,
    },
  });
}

export async function resolveObligationsForAdminRecord(userId: string, adminRecordId: string) {
  await prisma.obligation.updateMany({
    where: {
      userId,
      sourceEntityType: 'AdminRecord',
      sourceEntityId: adminRecordId,
      status: { in: ['open', 'confirmed', 'reopened'] },
    },
    data: { status: 'done', lastResolvedAt: new Date() },
  });
}
