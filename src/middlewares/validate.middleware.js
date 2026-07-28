import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';

/**
 * Run express-validator validationResult and throw ApiError on failure.
 * @type {import('express').RequestHandler}
 */
export function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  const errors = result.array({ onlyFirstError: false }).map((err) => ({
    field: err.path || err.param || err.type || 'unknown',
    message: err.msg,
    value: err.value,
    location: err.location,
  }));

  return next(ApiError.validation(MESSAGES.VALIDATION_FAILED, errors));
}

/**
 * Factory that returns validate middleware (for chaining after validator arrays).
 * @returns {import('express').RequestHandler}
 */
export function validateRequest() {
  return validate;
}

export const validateMiddleware = validate;
export default validate;
