import '@fastify/multipart';
import { prisma } from '@life-os/database';
import type {
  DocumentFamily,
  DocumentIntakeFeedbackType,
  DocumentPipelineStatus,
  DocumentSubtype,
} from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { parseMultipartUpload } from '../../lib/parse-multipart-upload.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { ingestDocumentUpload } from '../../services/document-intake-pipeline.js';

const documentFamilySchema = z.enum(['HEALTH', 'FINANCE_ADMIN', 'EDUCATION', 'GENERIC', 'UNKNOWN']);
const documentSubtypeSchema = z.enum([
  'LAB_REPORT',
  'PRESCRIPTION',
  'APPOINTMENT_NOTE',
  'BILL',
  'INVOICE',
  'STATEMENT',
  'RECEIPT',
  'ASSIGNMENT',
  'SYLLABUS',
  'OTHER',
  'SCREENSHOT',
]);

const patchDocumentBody = z
  .object({
    title: z.string().min(1).max(500).optional(),
    documentFamily: documentFamilySchema.optional(),
    documentSubtype: documentSubtypeSchema.optional(),
    classificationConfidence: z.number().min(0).max(1).optional(),
    trackingSuppressed: z.boolean().optional(),
    archiveOnly: z.boolean().optional(),
    summaryLine: z.string().max(2000).optional().nullable(),
    processingStatus: z
      .enum(['UPLOADED', 'OCR_PENDING', 'OCR_DONE', 'CLASSIFIED', 'EXTRACTED', 'NEEDS_REVIEW', 'ARCHIVED', 'FAILED'])
      .optional(),
  })
  .strict();

const feedbackBody = z.object({
  feedbackType: z.enum([
    'CONFIRM_DOCUMENT_TYPE',
    'CORRECT_DOCUMENT_TYPE',
    'CONFIRM_FIELD',
    'CORRECT_FIELD',
    'SUPPRESS_TRACKING',
    'FALSE_POSITIVE',
    'TRACK_THIS',
    'ARCHIVE_ONLY',
  ]),
  fieldName: z.string().max(200).optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
});

export async function registerDocumentRoutes(app: FastifyInstance) {
  app.get('/documents', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const status = z
      .string()
      .optional()
      .safeParse((req.query as { status?: string }).status);

    const where = {
      userId,
      ...(status.success && status.data
        ? { processingStatus: status.data as DocumentPipelineStatus }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          fileName: true,
          mimeType: true,
          documentFamily: true,
          documentSubtype: true,
          processingStatus: true,
          classificationConfidence: true,
          trackingSuppressed: true,
          archiveOnly: true,
          summaryLine: true,
          createdAt: true,
        },
      }),
    ]);

    return reply.send({
      data: rows,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/documents/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);

    const doc = await prisma.document.findFirst({
      where: { id, userId },
      include: {
        assets: true,
        pages: { orderBy: { pageNumber: 'asc' } },
        ocrBlocks: { orderBy: [{ pageId: 'asc' }, { blockIndex: 'asc' }], take: 200 },
        extractions: { orderBy: { createdAt: 'desc' }, take: 3 },
        extractedFields: { orderBy: { createdAt: 'asc' }, take: 100 },
        domainRecords: true,
        labResultRecords: { include: { items: true } },
        billRecords: true,
        assignmentRecords: true,
        deadlines: { orderBy: { dueAt: 'asc' } },
        intakeFeedback: { orderBy: { createdAt: 'desc' }, take: 50 },
        evidenceItems: { take: 20 },
      },
    });

    if (!doc) {
      return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }

    return reply.send({ document: doc });
  });

  app.post('/documents/upload', async (req, reply) => {
    const userId = await getUserId();
    let parsed: Awaited<ReturnType<typeof parseMultipartUpload>>;
    try {
      parsed = await parseMultipartUpload(req);
    } catch (e) {
      if ((e as Error).message === 'NO_FILE') {
        return reply.status(400).send({ error: { message: 'No file in multipart body', code: 'NO_FILE' } });
      }
      throw e;
    }

    try {
      const result = await ingestDocumentUpload({
        userId,
        buffer: parsed.buffer,
        fileName: parsed.fileName,
        mimeType: parsed.mimeType,
        title: parsed.title,
        sourceKind: parsed.sourceKind,
      });
      await writeAudit(userId, 'document.upload', {
        entityType: 'Document',
        entityId: result.documentId,
        meta: { mimeType: parsed.mimeType },
      });
      return reply.status(201).send(result);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'FILE_TOO_LARGE') {
        return reply.status(413).send({ error: { message: 'File too large', code: 'FILE_TOO_LARGE' } });
      }
      if (msg === 'UNSUPPORTED_TYPE') {
        return reply.status(415).send({ error: { message: 'Unsupported file type', code: 'UNSUPPORTED_TYPE' } });
      }
      throw e;
    }
  });

  app.post('/documents/capture-upload', async (req, reply) => {
    const userId = await getUserId();
    let parsed: Awaited<ReturnType<typeof parseMultipartUpload>>;
    try {
      parsed = await parseMultipartUpload(req);
    } catch (e) {
      if ((e as Error).message === 'NO_FILE') {
        return reply.status(400).send({ error: { message: 'No file in multipart body', code: 'NO_FILE' } });
      }
      throw e;
    }

    try {
      const result = await ingestDocumentUpload({
        userId,
        buffer: parsed.buffer,
        fileName: parsed.fileName,
        mimeType: parsed.mimeType,
        title: parsed.title,
        sourceKind: 'camera',
      });
      await writeAudit(userId, 'document.capture_upload', {
        entityType: 'Document',
        entityId: result.documentId,
        meta: { mimeType: parsed.mimeType },
      });
      return reply.status(201).send(result);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'FILE_TOO_LARGE') {
        return reply.status(413).send({ error: { message: 'File too large', code: 'FILE_TOO_LARGE' } });
      }
      if (msg === 'UNSUPPORTED_TYPE') {
        return reply.status(415).send({ error: { message: 'Unsupported file type', code: 'UNSUPPORTED_TYPE' } });
      }
      throw e;
    }
  });

  app.patch('/documents/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchDocumentBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.document.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }

    const data: {
      title?: string;
      documentFamily?: DocumentFamily;
      documentSubtype?: DocumentSubtype;
      classificationConfidence?: number | null;
      trackingSuppressed?: boolean;
      archiveOnly?: boolean;
      summaryLine?: string | null;
      processingStatus?: DocumentPipelineStatus;
    } = {};

    if (body.data.title != null) data.title = body.data.title;
    if (body.data.documentFamily != null) data.documentFamily = body.data.documentFamily as DocumentFamily;
    if (body.data.documentSubtype != null) data.documentSubtype = body.data.documentSubtype as DocumentSubtype;
    if (body.data.classificationConfidence != null) data.classificationConfidence = body.data.classificationConfidence;
    if (body.data.trackingSuppressed != null) data.trackingSuppressed = body.data.trackingSuppressed;
    if (body.data.archiveOnly != null) data.archiveOnly = body.data.archiveOnly;
    if (body.data.summaryLine !== undefined) data.summaryLine = body.data.summaryLine;
    if (body.data.processingStatus != null) data.processingStatus = body.data.processingStatus as DocumentPipelineStatus;

    const document = await prisma.document.update({
      where: { id },
      data,
    });

    await writeAudit(userId, 'document.patch', {
      entityType: 'Document',
      entityId: id,
      meta: { keys: Object.keys(data) },
    });

    return reply.send({ document });
  });

  app.post('/documents/:id/feedback', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = feedbackBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.document.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }

    const row = await prisma.documentIntakeFeedback.create({
      data: {
        documentId: id,
        feedbackType: body.data.feedbackType as DocumentIntakeFeedbackType,
        fieldName: body.data.fieldName ?? undefined,
        note: body.data.note ?? undefined,
      },
    });

    if (body.data.feedbackType === 'SUPPRESS_TRACKING' || body.data.feedbackType === 'FALSE_POSITIVE') {
      await prisma.document.update({
        where: { id },
        data: { trackingSuppressed: true },
      });
    }
    if (body.data.feedbackType === 'TRACK_THIS') {
      await prisma.document.update({
        where: { id },
        data: { trackingSuppressed: false },
      });
    }
    if (body.data.feedbackType === 'ARCHIVE_ONLY') {
      await prisma.document.update({
        where: { id },
        data: { archiveOnly: true, processingStatus: 'ARCHIVED' },
      });
    }

    await writeAudit(userId, 'document.feedback', {
      entityType: 'Document',
      entityId: id,
      meta: { feedbackType: body.data.feedbackType },
    });

    return reply.status(201).send({ feedback: row });
  });
}
