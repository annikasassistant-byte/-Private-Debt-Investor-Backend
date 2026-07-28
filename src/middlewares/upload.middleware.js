import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadDisk, uploadMemory, multerConfig } from '../config/multer.js';
import { MESSAGES } from '../constants/messages.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

/**
 * Wrap a multer middleware so MulterErrors become ApiError.
 * @param {import('express').RequestHandler} middleware
 * @returns {import('express').RequestHandler}
 */
function wrapMulter(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new ApiError(MESSAGES.FILE_TOO_LARGE, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.UPLOAD_ERROR),
        );
      }
      return next(
        new ApiError(
          err.message || MESSAGES.UPLOAD_FAILED,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.UPLOAD_ERROR,
        ),
      );
    });
  };
}

/**
 * Single file upload to disk.
 * @param {string} [fieldName='file']
 */
export function uploadSingle(fieldName = 'file') {
  return wrapMulter(uploadDisk.single(fieldName));
}

/**
 * Multiple files upload to disk.
 * @param {string} [fieldName='files']
 * @param {number} [maxCount]
 */
export function uploadMultiple(fieldName = 'files', maxCount = multerConfig.maxFiles) {
  return wrapMulter(uploadDisk.array(fieldName, maxCount));
}

/**
 * Fields upload to disk.
 * @param {{ name: string, maxCount?: number }[]} fields
 */
export function uploadFields(fields) {
  return wrapMulter(uploadDisk.fields(fields));
}

/**
 * Single file kept in memory (for sharp / Cloudinary).
 * @param {string} [fieldName='file']
 */
export function uploadSingleMemory(fieldName = 'file') {
  return wrapMulter(uploadMemory.single(fieldName));
}

/**
 * Avatar-specific memory upload.
 */
export const uploadAvatar = uploadSingleMemory('avatar');

/**
 * Ensure a required file was present.
 * @param {string} [fieldName='file']
 */
export function requireFile(fieldName = 'file') {
  return asyncHandler(async (req, _res, next) => {
    if (!req.file && !(req.files && (Array.isArray(req.files) ? req.files.length : req.files[fieldName]))) {
      throw new ApiError(
        `File field "${fieldName}" is required`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.UPLOAD_ERROR,
      );
    }
    next();
  });
}

export const uploadMiddleware = {
  uploadSingle,
  uploadMultiple,
  uploadFields,
  uploadSingleMemory,
  uploadAvatar,
  requireFile,
};

export default uploadMiddleware;
