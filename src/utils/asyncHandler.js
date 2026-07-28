/**
 * Wrap an async Express route/controller so rejections are forwarded to `next`.
 * Compatible with `express-async-errors` but safe to use explicitly.
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<unknown> | unknown} fn
 * @returns {import('express').RequestHandler}
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Wrap multiple handlers (e.g. middleware chain) with async error catching.
 * @param {...Function} handlers
 * @returns {import('express').RequestHandler[]}
 */
export function asyncHandlers(...handlers) {
  return handlers.map((handler) => asyncHandler(handler));
}

export default asyncHandler;
