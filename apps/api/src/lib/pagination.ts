import { paginationQuerySchema } from '@life-os/shared';
import type { FastifyRequest } from 'fastify';

export function parsePagination(req: FastifyRequest): { page: number; pageSize: number; skip: number } {
  const q = paginationQuerySchema.safeParse(req.query);
  const page = q.success ? q.data.page : 1;
  const pageSize = q.success ? q.data.pageSize : 20;
  return { page, pageSize, skip: (page - 1) * pageSize };
}
