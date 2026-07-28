import { configureCloudinary, cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { ApiError } from './ApiError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

configureCloudinary();

/**
 * Upload a file buffer or local path to Cloudinary.
 * @param {Buffer|string} source — buffer or file path
 * @param {object} [options]
 * @param {string} [options.folder]
 * @param {string} [options.publicId]
 * @param {string} [options.resourceType='auto']
 * @param {object} [options.transformation]
 * @param {string[]} [options.tags]
 * @returns {Promise<{
 *   publicId: string,
 *   url: string,
 *   secureUrl: string,
 *   format: string,
 *   width?: number,
 *   height?: number,
 *   bytes: number,
 *   resourceType: string,
 *   raw: object
 * }>}
 */
export async function uploadToCloudinary(source, options = {}) {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(
      'Cloudinary is not configured',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
    );
  }

  const {
    folder = env.CLOUDINARY_FOLDER,
    publicId,
    resourceType = 'auto',
    transformation,
    tags,
  } = options;

  try {
    /** @type {import('cloudinary').UploadApiOptions} */
    const uploadOptions = {
      folder,
      resource_type: resourceType,
      overwrite: false,
      unique_filename: true,
    };

    if (publicId) uploadOptions.public_id = publicId;
    if (transformation) uploadOptions.transformation = transformation;
    if (tags?.length) uploadOptions.tags = tags;

    let result;

    if (Buffer.isBuffer(source)) {
      result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
        stream.end(source);
      });
    } else {
      result = await cloudinary.uploader.upload(String(source), uploadOptions);
    }

    logger.info('Cloudinary upload success', {
      publicId: result.public_id,
      bytes: result.bytes,
    });

    return {
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      resourceType: result.resource_type,
      raw: result,
    };
  } catch (error) {
    logger.error('Cloudinary upload failed', { message: error.message });
    throw new ApiError(
      MESSAGES.UPLOAD_FAILED,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.UPLOAD_ERROR,
      true,
      { reason: error.message },
    );
  }
}

/**
 * Delete a Cloudinary asset by public ID.
 * @param {string} publicId
 * @param {string} [resourceType='image']
 * @returns {Promise<{ result: string }>}
 */
export async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(
      'Cloudinary is not configured',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
    );
  }

  if (!publicId) {
    throw ApiError.badRequest('publicId is required');
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    logger.info('Cloudinary asset deleted', { publicId, result: result.result });
    return result;
  } catch (error) {
    logger.error('Cloudinary delete failed', { message: error.message, publicId });
    throw new ApiError(
      'Failed to delete uploaded file',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.UPLOAD_ERROR,
      true,
      { reason: error.message },
    );
  }
}

/**
 * Build a transformed Cloudinary URL.
 * @param {string} publicId
 * @param {object|object[]} [transformation]
 * @returns {string}
 */
export function getCloudinaryUrl(publicId, transformation) {
  return cloudinary.url(publicId, {
    secure: env.CLOUDINARY_SECURE,
    transformation,
  });
}

export default {
  uploadToCloudinary,
  deleteFromCloudinary,
  getCloudinaryUrl,
};
