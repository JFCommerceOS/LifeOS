import { prisma } from '@life-os/database';

/** Mask digits except last `keep` chars (e.g. account numbers). */
export function maskDigits(text: string, keep = 4): string {
  const d = text.replace(/\D/g, '');
  if (d.length <= keep) return '••••';
  return `••••${d.slice(-keep)}`;
}

export async function redactNoteBody(userId: string, noteId: string, mode: 'strip' | 'mask'): Promise<{ ok: boolean }> {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
  if (!note) return { ok: false };
  const body =
    mode === 'strip'
      ? '[REDACTED — text removed by privacy action]'
      : `[REDACTED — ${note.body.length} characters hidden]`;
  await prisma.note.update({
    where: { id: noteId },
    data: { body },
  });
  return { ok: true };
}

export async function redactDocumentSummary(userId: string, documentId: string): Promise<{ ok: boolean }> {
  const doc = await prisma.document.findFirst({ where: { id: documentId, userId } });
  if (!doc) return { ok: false };
  await prisma.document.update({
    where: { id: documentId },
    data: {
      summaryLine: 'Redacted — user requested masking of document summary.',
    },
  });
  return { ok: true };
}
