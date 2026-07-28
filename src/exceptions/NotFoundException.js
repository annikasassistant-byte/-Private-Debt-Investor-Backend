import { AppException } from './AppException.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { MESSAGES } from '../constants/messages.js';

export class NotFoundException extends AppException {
  /**
   * @param {string} [message]
   * @param {unknown} [details]
   */
  constructor(message = MESSAGES.NOT_FOUND, details = null) {
    super(message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, true, details);
  }
}

export default NotFoundException;
