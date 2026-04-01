import type { AdminRecordType } from '@prisma/client';
import { prisma } from '@life-os/database';
import { classifyAdminFromText } from './admin-classification-service.js';
import {
  extractMoneyFromText,
  extractPrimaryDueDate,
  extractReturnByDate,
} from './admin-field-extraction.js';
import { ensureObligationForAdminRecord, resolveObligationsForAdminRecord } from './admin-obligation-derivation.js';

export async function ingestAdminRecordFromBillDocument(input: {
  userId: string;
  documentId: string;
  docTitle: string;
  issuerName: string | null;
  amountDue: number | null;
  dueAt: Date | null;
  currency: string | null;
  extractionConfidence: number;
}) {
  const dup = await prisma.adminRecord.findFirst({
    where: { userId: input.userId, sourceDocumentId: input.documentId },
  });
  if (dup) return dup;

  const ar = await prisma.adminRecord.create({
    data: {
      userId: input.userId,
      adminType: 'BILL',
      title: input.docTitle.slice(0, 500),
      issuerName: input.issuerName,
      amountValue: input.amountDue,
      currencyCode: input.currency ?? 'USD',
      dueAt: input.dueAt,
      sourceDocumentId: input.documentId,
      extractionConfidence: input.extractionConfidence,
      reasonSummary: 'Bill from document intake — confirm amount and due date.',
      status: 'ACTIVE',
    },
  });

  if (input.dueAt) {
    await prisma.adminDeadline.create({
      data: {
        userId: input.userId,
        adminRecordId: ar.id,
        deadlineKind: 'PAYMENT_DUE',
        dueAt: input.dueAt,
        confidence: input.extractionConfidence,
      },
    });
  }

  await prisma.evidenceItem.create({
    data: {
      userId: input.userId,
      documentId: input.documentId,
      kind: 'extracted',
      summary: `Admin Guard: ${ar.title.slice(0, 200)}`,
      sourceRef: ar.id,
    },
  });

  await ensureObligationForAdminRecord(input.userId, ar.id);
  return ar;
}

export async function ingestAdminRecordFromReceiptDocument(input: {
  userId: string;
  documentId: string;
  docTitle: string;
  fullText: string;
  extractionConfidence: number;
}) {
  const dup = await prisma.adminRecord.findFirst({
    where: { userId: input.userId, sourceDocumentId: input.documentId, adminType: 'RECEIPT' },
  });
  if (dup) return dup;

  const total = extractMoneyFromText(input.fullText);
  const purchaseAt = extractPrimaryDueDate(input.fullText);
  const returnEnd = extractReturnByDate(input.fullText);

  const ar = await prisma.adminRecord.create({
    data: {
      userId: input.userId,
      adminType: 'RECEIPT',
      title: input.docTitle.slice(0, 500),
      issuerName: null,
      amountValue: total,
      returnWindowEndsAt: returnEnd,
      sourceDocumentId: input.documentId,
      extractionConfidence: input.extractionConfidence,
      reasonSummary: 'Receipt from document intake — confirm return window if shown.',
      status: 'ACTIVE',
    },
  });

  await prisma.adminReceipt.create({
    data: {
      userId: input.userId,
      adminRecordId: ar.id,
      sourceDocumentId: input.documentId,
      totalValue: total,
      purchaseAt: purchaseAt ?? undefined,
      returnWindowEndsAt: returnEnd ?? undefined,
      currencyCode: 'USD',
    },
  });

  if (returnEnd) {
    await prisma.adminDeadline.create({
      data: {
        userId: input.userId,
        adminRecordId: ar.id,
        deadlineKind: 'RETURN_WINDOW_END',
        dueAt: returnEnd,
        confidence: input.extractionConfidence * 0.9,
      },
    });
  }

  await prisma.evidenceItem.create({
    data: {
      userId: input.userId,
      documentId: input.documentId,
      kind: 'extracted',
      summary: `Admin Guard receipt: ${ar.title.slice(0, 180)}`,
      sourceRef: ar.id,
    },
  });

  await ensureObligationForAdminRecord(input.userId, ar.id);
  return ar;
}

export async function ingestAdminRecordFromNote(input: {
  userId: string;
  noteId: string;
  title: string | null;
  body: string;
}) {
  const text = `${input.title ?? ''}\n${input.body}`;
  const { adminType, confidence, reason } = classifyAdminFromText(text);
  if (confidence < 0.55) return null;

  const amount = extractMoneyFromText(text);
  const due = extractPrimaryDueDate(text);

  const ar = await prisma.adminRecord.create({
    data: {
      userId: input.userId,
      adminType,
      title: (input.title ?? input.body.slice(0, 120)).slice(0, 500),
      amountValue: amount,
      dueAt: due,
      renewsAt: adminType === 'RENEWAL' || adminType === 'SUBSCRIPTION' ? due : null,
      extractionConfidence: confidence,
      reasonSummary: `From note: ${reason}`,
      status: 'ACTIVE',
    },
  });

  const kind =
    adminType === 'RENEWAL' || adminType === 'SUBSCRIPTION'
      ? 'RENEWAL_DUE'
      : adminType === 'RETURN_WINDOW'
        ? 'RETURN_WINDOW_END'
        : 'PAYMENT_DUE';

  if (due) {
    await prisma.adminDeadline.create({
      data: {
        userId: input.userId,
        adminRecordId: ar.id,
        deadlineKind: kind,
        dueAt: due,
        confidence,
        sourceFactId: input.noteId,
      },
    });
  }

  await prisma.evidenceItem.create({
    data: {
      userId: input.userId,
      kind: 'inferred',
      summary: `Admin Guard (note): ${ar.title.slice(0, 200)}`,
      sourceRef: ar.id,
    },
  });

  await ensureObligationForAdminRecord(input.userId, ar.id);
  return ar;
}

export async function recordAdminAction(
  userId: string,
  adminRecordId: string,
  action: 'MARK_PAID' | 'MARK_COMPLETED' | 'SNOOZE' | 'DISMISS' | 'CORRECT' | 'ARCHIVE',
  note: string,
  snoozeUntil?: Date | null,
) {
  await prisma.adminAction.create({
    data: {
      userId,
      adminRecordId,
      actionType: action,
      note: note.slice(0, 2000),
    },
  });

  if (action === 'MARK_PAID' || action === 'MARK_COMPLETED') {
    await prisma.adminRecord.update({
      where: { id: adminRecordId },
      data: { status: action === 'MARK_PAID' ? 'PAID' : 'COMPLETED' },
    });
    await resolveObligationsForAdminRecord(userId, adminRecordId);
  } else if (action === 'ARCHIVE' || action === 'DISMISS') {
    await prisma.adminRecord.update({
      where: { id: adminRecordId },
      data: { status: action === 'ARCHIVE' ? 'ARCHIVED' : 'DISMISSED' },
    });
    await resolveObligationsForAdminRecord(userId, adminRecordId);
  } else if (action === 'CORRECT') {
    /* audit row only; caller updates fields */
  } else if (action === 'SNOOZE' && snoozeUntil) {
    await prisma.adminRecord.update({
      where: { id: adminRecordId },
      data: { snoozedUntil: snoozeUntil },
    });
  }
}
