import { describe, it, expect } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/depth_dashboard_test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-characters!';
process.env.COOKIE_SECRET =
  process.env.COOKIE_SECRET || 'test-cookie-secret-min-32-characters!!';

const { ApiError } = await import('../../utils/ApiError.js');
const { HTTP_STATUS } = await import('../../constants/httpStatus.js');
const { ERROR_CODES } = await import('../../constants/errorCodes.js');

describe('ApiError', () => {
  it('creates a default internal error', () => {
    const err = new ApiError('boom');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(err.errorCode).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(err.isOperational).toBe(true);
  });

  it('serializes to JSON', () => {
    const err = ApiError.badRequest('Invalid', [{ field: 'email', message: 'required' }]);
    const json = err.toJSON();
    expect(json.success).toBe(false);
    expect(json.message).toBe('Invalid');
    expect(json.errorCode).toBe(ERROR_CODES.BAD_REQUEST);
    expect(json.errors).toEqual([{ field: 'email', message: 'required' }]);
    expect(json.timestamp).toBeTruthy();
  });

  it('static factories set correct status codes', () => {
    expect(ApiError.unauthorized().statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(ApiError.forbidden().statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    expect(ApiError.notFound().statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    expect(ApiError.conflict().statusCode).toBe(HTTP_STATUS.CONFLICT);
    expect(ApiError.validation().statusCode).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
    expect(ApiError.tooManyRequests().statusCode).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
    expect(ApiError.internal().statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(ApiError.internal().isOperational).toBe(false);
  });
});
