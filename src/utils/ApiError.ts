import { AppException } from '../exceptions/AppException.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';

/**
 * Custom API error class (alias-compatible with AppException for utility usage).
 */
export class ApiError extends AppException {
  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode: string = ERROR_CODES.INTERNAL_ERROR,
    isOperational = true,
    details: unknown = null,
  ) {
    super(message, statusCode, errorCode, isOperational, details);
    this.name = 'ApiError';
  }

  static badRequest(message = 'Bad request', details: unknown = null): ApiError {
    return new ApiError(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BAD_REQUEST, true, details);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN);
  }

  static notFound(message = 'Not found'): ApiError {
    return new ApiError(message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  static conflict(message = 'Conflict'): ApiError {
    return new ApiError(message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT);
  }

  static validation(message = 'Validation failed', details: unknown = null): ApiError {
    return new ApiError(
      message,
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      true,
      details,
    );
  }

  static tooManyRequests(message = 'Too many requests'): ApiError {
    return new ApiError(message, HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.TOO_MANY_REQUESTS);
  }

  static internal(message = 'Internal server error', isOperational = false): ApiError {
    return new ApiError(
      message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.INTERNAL_ERROR,
      isOperational,
    );
  }
}

export default ApiError;
