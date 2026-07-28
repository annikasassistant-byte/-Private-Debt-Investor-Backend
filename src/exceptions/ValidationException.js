import { AppException } from './AppException.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { MESSAGES } from '../constants/messages.js';

export class ValidationException extends AppException {
  /**
   * @param {string} [message]
   * @param {unknown} [details]
   */
  constructor(message = MESSAGES.VALIDATION_FAILED, details = null) {
    super(
      message,
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      true,
      details,
    );
  }
}

export default ValidationException;
