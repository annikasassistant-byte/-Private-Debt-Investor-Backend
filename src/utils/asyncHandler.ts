import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

/**
 * Wrap an async Express route/controller so rejections are forwarded to `next`.
 */
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Wrap multiple handlers (e.g. middleware chain) with async error catching.
 */
export function asyncHandlers(...handlers: AsyncRequestHandler[]): RequestHandler[] {
  return handlers.map((handler) => asyncHandler(handler));
}

export default asyncHandler;
