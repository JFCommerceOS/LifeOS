import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  DocumentDeadlineType,
  DocumentFamily,
  DocumentPipelineStatus,
  DocumentSubtype,
} from '@prisma/client';
import { prisma } from '@life-os/database';
import { upsertDataClassificationForDocument } from './data-classification-service.js';
import { upsertMemoryNodeForRef } from './continuity-memory-graph.js';
import { runCtxAfterDocumentCreated } from './ctx-capture-hooks.js';
import {
  ingestAdminRecordFromBillDocument,
  ingestAdminRecordFromReceiptDocument,
} from './admin-ingest-service.js';

const MAX_BYTES = 15 * 1024 * 1024;
const HIGH_CONF = 0.72;
const MID_CONF = 0.45;

export function getUploadRoot(): string {
  return process.env.DOCUMENT_UPLOAD_DIR ?? path.join(process.cwd(), 'data', 'uploads');
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'upload.bin';
}

export async function runOcr(buffer: Buffer, mimeType: string): Promise<{
  fullText: string;
  blocks: { text: string; confidence: number }[];
}> {
  if (mimeType === 'application/pdf') {
    try {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        const text = (result.text ?? '').trim();
        if (text.length > 0) {
          return { fullText: text, blocks: [{ text: text.slice(0, 8000), confidence: 0.82 }] };
        }
        return {
          fullText: '',
          blocks: [{ text: '[No extractable text in PDF — scanned PDF may need OCR engine]', confidence: 0.25 }],
        };
      } finally {
        await parser.destroy().catch(() => {});
      }
    } catch {
      return { fullText: '', blocks: [{ text: '[PDF parse failed]', confidence: 0.2 }] };
    }
  }
  if (mimeType.startsWith('image/')) {
    const hint =
      '[Image received — production OCR not enabled; classification uses filename and any embedded hints only.]';
    return { fullText: hint, blocks: [{ text: hint, confidence: 0.35 }] };
  }
  if (mimeType.startsWith('text/')) {
    const t = buffer.toString('utf8');
    return { fullText: t, blocks: [{ text: t.slice(0, 8000), confidence: 0.92 }] };
  }
  return { fullText: '', blocks: [] };
}

export function classifyFromText(fullText: string, fileName: string): {
  family: DocumentFamily;
  subtype: DocumentSubtype;
  confidence: number;
  reason: string;
} {
  const t = `${fullText}\n${fileName}`.toLowerCase();
  if (/\b(lab|cbc|glucose|hemoglobin|lipid|panel|reference range|mg\/dl|mmol)\b/.test(t)) {
    return {
      family: 'HEALTH',
      subtype: 'LAB_REPORT',
      confidence: 0.78,
      reason: 'Health / lab cues in text or name',
    };
  }
  if (
    /\b(receipt|thank you for your purchase|merchant copy|purchase order|transaction id|return policy|return by|subtotal|order #|order number)\b/.test(
      t,
    )
  ) {
    return {
      family: 'FINANCE_ADMIN',
      subtype: 'RECEIPT',
      confidence: 0.75,
      reason: 'Receipt / purchase cues',
    };
  }
  if (/\b(bill|invoice|amount due|pay by|utility|statement|account #|total due)\b/.test(t)) {
    return {
      family: 'FINANCE_ADMIN',
      subtype: 'BILL',
      confidence: 0.76,
      reason: 'Billing / invoice language',
    };
  }
  if (/\b(homework|assignment|due date|chapter|syllabus|course|teacher|class)\b/.test(t)) {
    return {
      family: 'EDUCATION',
      subtype: 'ASSIGNMENT',
      confidence: 0.74,
      reason: 'Education / assignment cues',
    };
  }
  if (fullText.length < 40 && !/\d/.test(t)) {
    return {
      family: 'UNKNOWN',
      subtype: 'SCREENSHOT',
      confidence: 0.32,
      reason: 'Very little text — needs review',
    };
  }
  return {
    family: 'GENERIC',
    subtype: 'OTHER',
    confidence: 0.48,
    reason: 'No strong domain match',
  };
}

function extractDateCandidates(text: string): Date[] {
  const out: Date[] = [];
  const re = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/g;
  let m: RegExpExecArray | null;
  const s = text.slice(0, 20000);
  while ((m = re.exec(s)) !== null) {
    try {
      if (m[4]) {
        out.push(new Date(`${m[4]}-${m[5]}-${m[6]}T12:00:00Z`));
      } else {
        const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
        out.push(new Date(y, parseInt(m[1], 10) - 1, parseInt(m[2], 10), 12));
      }
    } catch {
      /* skip */
    }
  }
  return out.filter((d) => !Number.isNaN(d.getTime()));
}

function pickFutureDue(dates: Date[]): Date | null {
  const now = Date.now();
  const future = dates.filter((d) => d.getTime() > now - 86400000);
  future.sort((a, b) => a.getTime() - b.getTime());
  return future[0] ?? null;
}

function extractMoney(text: string): number | null {
  const m = text.match(/\$\s*([\d,]+\.\d{2})|([\d,]+\.\d{2})\s*(?:USD|usd)?/);
  if (m) return parseFloat((m[1] ?? m[2]).replace(/,/g, ''));
  return null;
}

function extractIssuerLine(text: string): string | null {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  return lines[0]?.slice(0, 200) ?? null;
}

export function deriveDeadlines(args: {
  family: DocumentFamily;
  subtype: DocumentSubtype;
  fullText: string;
  classifyConfidence: number;
}): { type: DocumentDeadlineType; dueAt: Date | null; confidence: number }[] {
  const dates = extractDateCandidates(args.fullText);
  const due = pickFutureDue(dates);
  const out: { type: DocumentDeadlineType; dueAt: Date | null; confidence: number }[] = [];
  if (args.subtype === 'BILL' && due) {
    out.push({
      type: 'PAYMENT_DUE',
      dueAt: due,
      confidence: Math.min(0.9, args.classifyConfidence + 0.05),
    });
  }
  if (args.subtype === 'ASSIGNMENT' && due) {
    out.push({
      type: 'ASSIGNMENT_DUE',
      dueAt: due,
      confidence: Math.min(0.88, args.classifyConfidence + 0.05),
    });
  }
  if (args.subtype === 'LAB_REPORT' && /\b(follow|repeat|retest)\b/i.test(args.fullText) && due) {
    out.push({
      type: 'FOLLOW_UP_DUE',
      dueAt: due,
      confidence: 0.55,
    });
  }
  return out;
}

export async function ingestDocumentUpload(input: {
  userId: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  title?: string;
  sourceKind: 'upload' | 'camera';
}): Promise<{ documentId: string; status: DocumentPipelineStatus }> {
  if (input.buffer.length > MAX_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }
  const allowed =
    input.mimeType.startsWith('image/') ||
    input.mimeType === 'application/pdf' ||
    input.mimeType.startsWith('text/');
  if (!allowed) {
    throw new Error('UNSUPPORTED_TYPE');
  }

  const title = input.title?.trim() || input.fileName;
  const doc = await prisma.document.create({
    data: {
      userId: input.userId,
      title,
      mimeType: input.mimeType,
      fileName: input.fileName,
      sourceKind: input.sourceKind,
      processingStatus: 'OCR_PENDING',
    },
  });

  const root = getUploadRoot();
  await mkdir(path.join(root, input.userId, doc.id), { recursive: true });
  const safe = sanitizeFileName(input.fileName);
  const abs = path.join(root, input.userId, doc.id, safe);
  await writeFile(abs, input.buffer);
  const checksum = crypto.createHash('sha256').update(input.buffer).digest('hex');
  const localUri = path.relative(root, abs).replace(/\\/g, '/');

  await prisma.documentAsset.create({
    data: {
      documentId: doc.id,
      localUri,
      checksum,
      fileSizeBytes: input.buffer.length,
    },
  });

  await prisma.documentPage.create({
    data: { documentId: doc.id, pageNumber: 1 },
  });

  const ocr = await runOcr(input.buffer, input.mimeType);
  const page = await prisma.documentPage.findFirst({
    where: { documentId: doc.id },
    orderBy: { pageNumber: 'asc' },
  });

  let bi = 0;
  for (const b of ocr.blocks) {
    await prisma.ocrBlock.create({
      data: {
        documentId: doc.id,
        pageId: page?.id,
        blockIndex: bi++,
        text: b.text,
        confidence: b.confidence,
      },
    });
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: { processingStatus: 'OCR_DONE', pageCount: 1 },
  });

  const cls = classifyFromText(ocr.fullText, input.fileName);
  await prisma.document.update({
    where: { id: doc.id },
    data: {
      documentFamily: cls.family,
      documentSubtype: cls.subtype,
      classificationConfidence: cls.confidence,
      processingStatus: cls.confidence < MID_CONF ? 'NEEDS_REVIEW' : 'CLASSIFIED',
      summaryLine: cls.reason.slice(0, 500),
    },
  });

  await upsertDataClassificationForDocument({
    userId: input.userId,
    documentId: doc.id,
    documentFamily: cls.family,
  });

  const extraction = await prisma.documentExtraction.create({
    data: {
      documentId: doc.id,
      extractionVersion: 1,
      extractionStatus: 'complete',
      rawTextSummary: ocr.fullText.slice(0, 12000),
    },
  });

  const fields: { name: string; type: string; value: unknown; conf: number; observed: 'OBSERVED' | 'EXTRACTED' | 'INFERRED' }[] = [];
  const duePick = pickFutureDue(extractDateCandidates(ocr.fullText));
  if (duePick) {
    fields.push({
      name: 'due_date_candidate',
      type: 'datetime',
      value: duePick.toISOString(),
      conf: cls.confidence * 0.85,
      observed: 'EXTRACTED',
    });
  }
  if (cls.subtype === 'BILL') {
    const amt = extractMoney(ocr.fullText);
    const issuer = extractIssuerLine(ocr.fullText);
    if (amt != null) {
      fields.push({ name: 'amount_due', type: 'money', value: amt, conf: cls.confidence * 0.8, observed: 'EXTRACTED' });
    }
    if (issuer) {
      fields.push({ name: 'issuer_line', type: 'text', value: issuer, conf: 0.55, observed: 'OBSERVED' });
    }
  }
  if (cls.subtype === 'ASSIGNMENT') {
    const subj = ocr.fullText.match(/(?:class|course|subject)\s*[:\s]+([^\n]+)/i);
    if (subj) {
      fields.push({ name: 'subject', type: 'text', value: subj[1].trim().slice(0, 200), conf: 0.5, observed: 'EXTRACTED' });
    }
  }

  const blockIds = await prisma.ocrBlock.findMany({
    where: { documentId: doc.id },
    select: { id: true },
    take: 4,
  });
  const evidenceIdsJson = JSON.stringify(blockIds.map((b) => b.id));

  for (const f of fields) {
    await prisma.extractedField.create({
      data: {
        documentId: doc.id,
        extractionId: extraction.id,
        fieldName: f.name,
        fieldType: f.type,
        fieldValueJson: JSON.stringify(f.value),
        confidence: f.conf,
        evidenceBlockIdsJson: evidenceIdsJson,
        observedOrInferred: f.observed,
      },
    });
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: { processingStatus: 'EXTRACTED' },
  });

  /* Domain records */
  if (cls.family === 'HEALTH' && cls.subtype === 'LAB_REPORT') {
    const testDates = extractDateCandidates(ocr.fullText);
    const testDate = testDates[0] ?? null;
    await prisma.labResultRecord.create({
      data: {
        documentId: doc.id,
        sourceName: extractIssuerLine(ocr.fullText),
        testDate,
        panelName: 'Lab panel',
      },
    });
    await prisma.documentDomainRecord.create({
      data: {
        documentId: doc.id,
        domainType: 'health_lab',
        recordStatus: 'draft',
        summary: 'Lab report — review values and confirm.',
      },
    });
  } else if (cls.family === 'FINANCE_ADMIN' && cls.subtype === 'BILL') {
    await prisma.billRecord.create({
      data: {
        documentId: doc.id,
        issuerName: extractIssuerLine(ocr.fullText),
        amountDue: extractMoney(ocr.fullText),
        dueAt: duePick,
      },
    });
    await prisma.documentDomainRecord.create({
      data: {
        documentId: doc.id,
        domainType: 'bill',
        recordStatus: 'draft',
        summary: 'Bill — confirm amount and due date.',
      },
    });
    await ingestAdminRecordFromBillDocument({
      userId: input.userId,
      documentId: doc.id,
      docTitle: title,
      issuerName: extractIssuerLine(ocr.fullText),
      amountDue: extractMoney(ocr.fullText),
      dueAt: duePick,
      currency: 'USD',
      extractionConfidence: cls.confidence,
    });
  } else if (cls.family === 'FINANCE_ADMIN' && cls.subtype === 'RECEIPT') {
    await prisma.documentDomainRecord.create({
      data: {
        documentId: doc.id,
        domainType: 'receipt',
        recordStatus: 'draft',
        summary: 'Receipt — confirm totals and return window.',
      },
    });
    await ingestAdminRecordFromReceiptDocument({
      userId: input.userId,
      documentId: doc.id,
      docTitle: title,
      fullText: ocr.fullText,
      extractionConfidence: cls.confidence,
    });
  } else if (cls.family === 'EDUCATION' && cls.subtype === 'ASSIGNMENT') {
    await prisma.assignmentRecord.create({
      data: {
        documentId: doc.id,
        subjectName: null,
        assignmentTitle: title.slice(0, 200),
        dueAt: duePick,
        instructionSummary: ocr.fullText.slice(0, 500),
      },
    });
    await prisma.documentDomainRecord.create({
      data: {
        documentId: doc.id,
        domainType: 'assignment',
        recordStatus: 'draft',
        summary: 'Assignment — confirm due date and instructions.',
      },
    });
  } else {
    await prisma.documentDomainRecord.create({
      data: {
        documentId: doc.id,
        domainType: 'generic',
        recordStatus: 'draft',
        summary: cls.reason,
      },
    });
  }

  const dlines = deriveDeadlines({
    family: cls.family,
    subtype: cls.subtype,
    fullText: ocr.fullText,
    classifyConfidence: cls.confidence,
  });
  for (const d of dlines) {
    if (d.dueAt) {
      await prisma.documentDeadline.create({
        data: {
          documentId: doc.id,
          deadlineType: d.type,
          dueAt: d.dueAt,
          confidence: d.confidence,
        },
      });
    }
  }

  await prisma.evidenceItem.create({
    data: {
      userId: input.userId,
      documentId: doc.id,
      kind: 'extracted',
      summary: `Document intake: ${title} (${cls.family} / ${cls.subtype})`,
      sourceRef: doc.id,
    },
  });

  await upsertMemoryNodeForRef({
    userId: input.userId,
    nodeType: 'DOCUMENT',
    refEntityType: 'Document',
    refEntityId: doc.id,
    summary: title.slice(0, 500),
    confidence: cls.confidence,
  });

  const shouldObligation =
    !doc.archiveOnly &&
    cls.confidence >= HIGH_CONF &&
    duePick != null &&
    cls.subtype === 'ASSIGNMENT';

  if (shouldObligation) {
    await prisma.obligation.create({
      data: {
        userId: input.userId,
        title: `Assignment due: ${title.slice(0, 80)}`,
        status: 'open',
        dueAt: duePick,
        obligationType: 'TASK_DEADLINE',
        reasonSummary: `From document upload (confidence ${cls.confidence.toFixed(2)}). ${cls.reason}`,
        confidence: Math.min(0.95, cls.confidence),
        sourceEntityType: 'Document',
        sourceEntityId: doc.id,
      },
    });
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: {
      storageKey: localUri,
    },
  });

  await runCtxAfterDocumentCreated(input.userId, { id: doc.id }, ocr.fullText).catch(() => {});

  return { documentId: doc.id, status: 'EXTRACTED' };
}
