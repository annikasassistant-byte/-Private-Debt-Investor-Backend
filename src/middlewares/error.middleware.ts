import multer from 'multer';
import mongoose from 'mongoose';
import { AppException } from '../exceptions/AppException.js';
import { ApiError } from '../utils/ApiError.js';
import env, { isProduction } from '../config/env.js';
import logger from '../config/logger.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { MESSAGES } from '../constants/messages.js';

/**
 * Normalize known error types into ApiError / AppException.
 * @param {Error} err
 * @returns {AppException}
 */
function normalizeError(err) {
  if (err instanceof AppException) {
    return err;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new ApiError(MESSAGES.FILE_TOO_LARGE, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.UPLOAD_ERROR);
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return new ApiError(err.message || MESSAGES.UPLOAD_FAILED, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.UPLOAD_ERROR);
    }
    return new ApiError(err.message || MESSAGES.UPLOAD_FAILED, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.UPLOAD_ERROR);
  }

  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return ApiError.validation(MESSAGES.VALIDATION_FAILED, details);
  }

  if (err.name === 'CastError') {
    return new ApiError(
      `Invalid ${err.path || 'id'}: ${err.value}`,
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.CAST_ERROR,
    );
  }

  if (err.code === 11000 || err.name === 'MongoServerError') {
    const fields = err.keyValue ? Object.keys(err.keyValue) : [];
    return new ApiError(
      fields.length ? `Duplicate value for: ${fields.join(', ')}` : MESSAGES.CONFLICT,
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.DUPLICATE_KEY,
      true,
      err.keyValue || null,
    );
  }

  if (err.name === 'JsonWebTokenError') {
    return ApiError.unauthorized(MESSAGES.TOKEN_INVALID);
  }

  if (err.name === 'TokenExpiredError') {
    return ApiError.unauthorized(MESSAGES.TOKEN_EXPIRED);
  }

  if (err.message?.includes('CORS')) {
    return ApiError.forbidden(err.message);
  }

  return new ApiError(
    isProduction ? MESSAGES.INTERNAL_ERROR : err.message || MESSAGES.INTERNAL_ERROR,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Global Express error handler.
 * Response shape: { success, message, errors, stack?, errorCode?, timestamp }
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorMiddleware(err, req, res, _next) {
  const normalized = normalizeError(err);

  if (!normalized.isOperational) {
    logger.error('Unhandled error', {
      message: err.message,
      stack: err.stack,
      requestId: req.requestId,
      path: req.originalUrl,
      method: req.method,
    });
  } else {
    logger.warn('Operational error', {
      message: normalized.message,
      errorCode: normalized.errorCode,
      statusCode: normalized.statusCode,
      requestId: req.requestId,
      path: req.originalUrl,
    });
  }

  const body = {
    success: false,
    message: normalized.message,
    errorCode: normalized.errorCode,
    ...(normalized.details
      ? { errors: Array.isArray(normalized.details) ? normalized.details : normalized.details }
      : { errors: null }),
    timestamp: normalized.timestamp || new Date().toISOString(),
    requestId: req.requestId || null,
  };

  if (!isProduction && err.stack) {
    body.stack = err.stack;
  }

  // Avoid sending headers twice
  if (res.headersSent) {
    return;
  }

  const status = normalized.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  res.status(status).json(body);
}

/**
 * Catch unhandled mongoose connection-level issues mid-request.
 */
export function ensureDbConnected(req, _res, next) {
  if (mongoose.connection.readyState !== 1) {
    return next(
      new ApiError(MESSAGES.DATABASE_ERROR, HTTP_STATUS.SERVICE_UNAVAILABLE, ERROR_CODES.DATABASE_ERROR),
    );
  }
  return next();
}

export default errorMiddleware;
