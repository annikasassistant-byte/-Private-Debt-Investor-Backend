import { AppException } from './AppException.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { MESSAGES } from '../constants/messages.js';

export class ForbiddenException extends AppException {
  /**
   * @param {string} [message]
   * @param {unknown} [details]
   */
  constructor(message = MESSAGES.FORBIDDEN, details = null) {
    super(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, true, details);
  }
}

export default ForbiddenException;
