import { AppException } from '../exceptions/AppException.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';

/**
 * Custom API error class (alias-compatible with AppException for utility usage).
 * Prefer domain exceptions under `src/exceptions/` for typed errors.
 */
export class ApiError extends AppException {
  /**
   * @param {string} message
   * @param {number} [statusCode]
   * @param {string} [errorCode]
   * @param {boolean} [isOperational]
   * @param {unknown} [details]
   */
  constructor(
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode = ERROR_CODES.INTERNAL_ERROR,
    isOperational = true,
    details = null,
  ) {
    super(message, statusCode, errorCode, isOperational, details);
    this.name = 'ApiError';
  }

  /**
   * @param {string} message
   * @param {unknown} [details]
   */
  static badRequest(message = 'Bad request', details = null) {
    return new ApiError(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BAD_REQUEST, true, details);
  }

  /**
   * @param {string} message
   */
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
  }

  /**
   * @param {string} message
   */
  static forbidden(message = 'Forbidden') {
    return new ApiError(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN);
  }

  /**
   * @param {string} message
   */
  static notFound(message = 'Not found') {
    return new ApiError(message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  /**
   * @param {string} message
   */
  static conflict(message = 'Conflict') {
    return new ApiError(message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT);
  }

  /**
   * @param {string} message
   * @param {unknown} [details]
   */
  static validation(message = 'Validation failed', details = null) {
    return new ApiError(
      message,
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      true,
      details,
    );
  }

  /**
   * @param {string} message
   */
  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(message, HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.TOO_MANY_REQUESTS);
  }

  /**
   * @param {string} message
   * @param {boolean} [isOperational]
   */
  static internal(message = 'Internal server error', isOperational = false) {
    return new ApiError(
      message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.INTERNAL_ERROR,
      isOperational,
    );
  }
}

export default ApiError;
