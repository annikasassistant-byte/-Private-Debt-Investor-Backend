import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';

/**
 * Run express-validator validationResult and throw ApiError on failure.
 */
export function validate(req: Request, _res: Response, next: NextFunction): void {
  const result = validationResult(req);
  if (result.isEmpty()) {
    next();
    return;
  }

  const errors = result.array({ onlyFirstError: false }).map((err) => ({
    field: ('path' in err && err.path) || ('param' in err && err.param) || err.type || 'unknown',
    message: err.msg,
    value: 'value' in err ? err.value : undefined,
    location: 'location' in err ? err.location : undefined,
  }));

  next(ApiError.validation(MESSAGES.VALIDATION_FAILED, errors));
}

/**
 * Factory that returns validate middleware (for chaining after validator arrays).
 */
export function validateRequest(): RequestHandler {
  return validate;
}

export const validateMiddleware = validate;
export default validate;
