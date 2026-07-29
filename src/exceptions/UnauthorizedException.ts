import { AppException } from './AppException.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { MESSAGES } from '../constants/messages.js';

export class UnauthorizedException extends AppException {
  constructor(
    message: string = MESSAGES.UNAUTHORIZED,
    errorCode: string = ERROR_CODES.UNAUTHORIZED,
    details: unknown = null,
  ) {
    super(message, HTTP_STATUS.UNAUTHORIZED, errorCode, true, details);
  }
}

export default UnauthorizedException;
