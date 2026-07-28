import { AppException } from './AppException.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { MESSAGES } from '../constants/messages.js';

export class ConflictException extends AppException {
  constructor(message: string = MESSAGES.CONFLICT, details: unknown = null) {
    super(message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, true, details);
  }
}

export default ConflictException;
