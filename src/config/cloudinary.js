import { v2 as cloudinary } from 'cloudinary';
import env from './env.js';
import logger from './logger.js';

let configured = false;

/**
 * Configure the Cloudinary SDK from environment variables.
 * @returns {typeof cloudinary}
 */
export function configureCloudinary() {
  if (configured) {
    return cloudinary;
  }

  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    logger.warn('Cloudinary credentials are incomplete — uploads will fail until configured');
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: env.CLOUDINARY_SECURE,
  });

  configured = true;
  logger.debug('Cloudinary configured', {
    cloudName: env.CLOUDINARY_CLOUD_NAME || '(empty)',
    folder: env.CLOUDINARY_FOLDER,
  });

  return cloudinary;
}

/**
 * Whether Cloudinary credentials appear present.
 * @returns {boolean}
 */
export function isCloudinaryConfigured() {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  );
}

export const cloudinaryConfig = Object.freeze({
  cloudName: env.CLOUDINARY_CLOUD_NAME,
  folder: env.CLOUDINARY_FOLDER,
  secure: env.CLOUDINARY_SECURE,
});

export { cloudinary };
export default {
  configureCloudinary,
  isCloudinaryConfigured,
  cloudinary,
  cloudinaryConfig,
};
