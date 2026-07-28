import type { Response } from 'express';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { MESSAGES } from '../constants/messages.js';

/**
 * Standard API success response builder.
 */
export class ApiResponse {
  static send(
    res: Response,
    {
      statusCode = HTTP_STATUS.OK,
      message = MESSAGES.SUCCESS,
      data = null,
      meta,
    }: {
      statusCode?: number;
      message?: string;
      data?: unknown;
      meta?: unknown;
    } = {},
  ): Response {
    const body = {
      success: true,
      message,
      ...(data !== undefined && data !== null ? { data } : {}),
      ...(meta ? { meta } : {}),
      timestamp: new Date().toISOString(),
    };

    return res.status(statusCode).json(body);
  }

  static ok(
    res: Response,
    data: unknown = null,
    message: string = MESSAGES.SUCCESS,
    meta?: unknown,
  ): Response {
    return ApiResponse.send(res, { statusCode: HTTP_STATUS.OK, message, data, meta });
  }

  static created(
    res: Response,
    data: unknown = null,
    message: string = MESSAGES.CREATED,
    meta?: unknown,
  ): Response {
    return ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message, data, meta });
  }

  static noContent(res: Response): Response {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  static paginated(
    res: Response,
    data: unknown,
    meta: unknown,
    message: string = MESSAGES.LIST_FETCHED,
  ): Response {
    return ApiResponse.send(res, {
      statusCode: HTTP_STATUS.OK,
      message,
      data,
      meta,
    });
  }
}

export default ApiResponse;
