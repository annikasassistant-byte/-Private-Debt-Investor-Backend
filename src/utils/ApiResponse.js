import { HTTP_STATUS } from '../constants/httpStatus.js';
import { MESSAGES } from '../constants/messages.js';

/**
 * Standard API success response builder.
 */
export class ApiResponse {
  /**
   * @param {import('express').Response} res
   * @param {object} options
   * @param {number} [options.statusCode]
   * @param {string} [options.message]
   * @param {unknown} [options.data]
   * @param {object} [options.meta]
   * @returns {import('express').Response}
   */
  static send(res, { statusCode = HTTP_STATUS.OK, message = MESSAGES.SUCCESS, data = null, meta } = {}) {
    const body = {
      success: true,
      message,
      ...(data !== undefined && data !== null ? { data } : {}),
      ...(meta ? { meta } : {}),
      timestamp: new Date().toISOString(),
    };

    return res.status(statusCode).json(body);
  }

  /**
   * @param {import('express').Response} res
   * @param {unknown} [data]
   * @param {string} [message]
   * @param {object} [meta]
   */
  static ok(res, data = null, message = MESSAGES.SUCCESS, meta) {
    return ApiResponse.send(res, { statusCode: HTTP_STATUS.OK, message, data, meta });
  }

  /**
   * @param {import('express').Response} res
   * @param {unknown} [data]
   * @param {string} [message]
   * @param {object} [meta]
   */
  static created(res, data = null, message = MESSAGES.CREATED, meta) {
    return ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message, data, meta });
  }

  /**
   * @param {import('express').Response} res
   */
  static noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  /**
   * @param {import('express').Response} res
   * @param {unknown} data
   * @param {object} meta
   * @param {string} [message]
   */
  static paginated(res, data, meta, message = MESSAGES.LIST_FETCHED) {
    return ApiResponse.send(res, {
      statusCode: HTTP_STATUS.OK,
      message,
      data,
      meta,
    });
  }
}

export default ApiResponse;
