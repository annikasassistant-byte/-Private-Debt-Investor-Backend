import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';

/**
 * Base application exception — operational errors that are safe to expose to clients.
 */
export class AppException extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {string} [errorCode=INTERNAL_ERROR]
   * @param {boolean} [isOperational=true]
   * @param {unknown} [details=null]
   */
  constructor(
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode = ERROR_CODES.INTERNAL_ERROR,
    isOperational = true,
    details = null,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize for JSON API responses.
   * @returns {object}
   */
  toJSON() {
    return {
      success: false,
      message: this.message,
      errorCode: this.errorCode,
      ...(this.details ? { errors: this.details } : {}),
      timestamp: this.timestamp,
    };
  }
}

export default AppException;
