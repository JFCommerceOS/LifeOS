import type { FastifyRequest } from 'fastify';

export async function parseMultipartUpload(req: FastifyRequest): Promise<{
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  title?: string;
  sourceKind: 'upload' | 'camera';
}> {
  let buffer: Buffer | null = null;
  let mimeType = 'application/octet-stream';
  let fileName = 'upload.bin';
  let title: string | undefined;
  let sourceKind: 'upload' | 'camera' = 'upload';

  for await (const part of req.parts()) {
    if (part.type === 'file') {
      buffer = await part.toBuffer();
      mimeType = part.mimetype || 'application/octet-stream';
      fileName = part.filename || 'upload.bin';
    } else if (part.type === 'field') {
      const v = String(part.value ?? '');
      if (part.fieldname === 'title' && v.trim()) title = v.trim().slice(0, 500);
      if (part.fieldname === 'sourceKind' && v === 'camera') sourceKind = 'camera';
    }
  }

  if (!buffer) {
    throw new Error('NO_FILE');
  }
  return { buffer, mimeType, fileName, title, sourceKind };
}
