import { randomUUID } from 'node:crypto';

/**
 * Attach a unique request id (honors inbound `x-request-id`).
 * @type {import('express').RequestHandler}
 */
export function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const requestId =
    typeof incoming === 'string' && incoming.trim() ? incoming.trim().slice(0, 128) : randomUUID();

  req.requestId = requestId;
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export default requestIdMiddleware;
