/**
 * Record request start time and expose duration via header (before response ends).
 * @type {import('express').RequestHandler}
 */
export function requestTimeMiddleware(req, res, next) {
  req.requestTime = new Date();
  req.startTime = process.hrtime.bigint();

  const originalEnd = res.end;
  res.end = function patchedEnd(...args) {
    try {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - req.startTime) / 1e6;
      req.durationMs = durationMs;
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
      }
    } catch {
      /* never fail the response over timing headers */
    }
    return originalEnd.apply(this, args);
  };

  next();
}

export default requestTimeMiddleware;
