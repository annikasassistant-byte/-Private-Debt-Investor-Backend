import { AppException } from './AppException.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { MESSAGES } from '../constants/messages.js';

export class UnauthorizedException extends AppException {
  /**
   * @param {string} [message]
   * @param {string} [errorCode]
   * @param {unknown} [details]
   */
  constructor(
    message = MESSAGES.UNAUTHORIZED,
    errorCode = ERROR_CODES.UNAUTHORIZED,
    details = null,
  ) {
    super(message, HTTP_STATUS.UNAUTHORIZED, errorCode, true, details);
  }
}

export default UnauthorizedException;
