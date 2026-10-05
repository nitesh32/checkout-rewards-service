import type { FastifyInstance } from 'fastify';

/**
 * HTTP clients commonly send `content-type: application/json` with an empty body on POSTs that
 * need none (e.g. creating a cart), which Fastify rejects by default. Treat an empty body as `{}`
 * so each route's schema decides whether anything is actually required.
 */
export function tolerateEmptyJsonBodies(app: FastifyInstance): void {
  app.addHook('onRequest', (request, _reply, done) => {
    if (request.headers['content-length'] === '0') delete request.headers['content-type'];
    done();
  });
  app.addHook('preValidation', (request, _reply, done) => {
    if (request.body === undefined && request.method !== 'GET') request.body = {};
    done();
  });
}
