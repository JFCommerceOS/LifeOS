import type { FastifyError } from 'fastify';

/** Attach HTTP status to an Error for Fastify's error handler (`errors.ts` reads `statusCode`). */
export function createHttpError(statusCode: number, message: string): FastifyError {
  const e = new Error(message) as FastifyError;
  e.statusCode = statusCode;
  return e;
}

export function isHttpError(e: unknown): e is FastifyError {
  return typeof e === 'object' && e !== null && 'statusCode' in e && typeof (e as FastifyError).statusCode === 'number';
}
