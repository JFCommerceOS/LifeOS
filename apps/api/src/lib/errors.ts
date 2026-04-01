import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    if (error.code === 'FST_ERR_VALIDATION') {
      return reply.status(400).send({
        error: {
          message: error.message,
          code: 'VALIDATION',
        },
      });
    }

    const statusCode = error.statusCode ?? 500;
    const code =
      statusCode === 400
        ? 'BAD_REQUEST'
        : statusCode === 401
          ? 'UNAUTHORIZED'
          : statusCode === 403
            ? 'FORBIDDEN'
            : statusCode === 404
              ? 'NOT_FOUND'
              : 'INTERNAL';

    if (statusCode >= 500) {
      _request.log.error(error);
    }

    const message =
      process.env.NODE_ENV === 'production' && statusCode >= 500
        ? 'Internal Server Error'
        : error.message;

    return reply.status(statusCode).send({
      error: {
        message,
        code,
      },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: {
        message: 'Not Found',
        code: 'NOT_FOUND',
      },
    });
  });
}
