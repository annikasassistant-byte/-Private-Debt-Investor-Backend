import { AppException } from './AppException.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { MESSAGES } from '../constants/messages.js';

export class TooManyRequestsException extends AppException {
  /**
   * @param {string} [message]
   * @param {unknown} [details]
   */
  constructor(message = MESSAGES.TOO_MANY_REQUESTS, details = null) {
    super(
      message,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      ERROR_CODES.TOO_MANY_REQUESTS,
      true,
      details,
    );
  }
}

export default TooManyRequestsException;
