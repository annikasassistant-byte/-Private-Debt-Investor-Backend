import { v2 as cloudinary } from 'cloudinary';
import env from './env.js';
import logger from './logger.js';

let configured = false;

/**
 * Parse cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 * @param {string} [url]
 * @returns {{ cloudName: string, apiKey: string, apiSecret: string } | null}
 */
export function parseCloudinaryUrl(url = env.CLOUDINARY_URL) {
  if (!url || typeof url !== 'string' || !url.startsWith('cloudinary://')) {
    return null;
  }

  try {
    const parsed = new URL(url.trim());
    const cloudName = parsed.hostname;
    const apiKey = decodeURIComponent(parsed.username || '');
    const apiSecret = decodeURIComponent(parsed.password || '');
    if (!cloudName || !apiKey || !apiSecret) return null;
    return { cloudName, apiKey, apiSecret };
  } catch {
    return null;
  }
}

/**
 * Configure Cloudinary from CLOUDINARY_URL only.
 * @returns {typeof cloudinary}
 */
export function configureCloudinary() {
  if (configured) return cloudinary;

  const creds = parseCloudinaryUrl(env.CLOUDINARY_URL);

  if (!creds) {
    logger.warn('Cloudinary not configured — set CLOUDINARY_URL in .env.server');
    return cloudinary;
  }

  // Keep process.env in sync so the SDK / helpers that read CLOUDINARY_URL work
  process.env.CLOUDINARY_URL = env.CLOUDINARY_URL;

  cloudinary.config({
    cloud_name: creds.cloudName,
    api_key: creds.apiKey,
    api_secret: creds.apiSecret,
    secure: env.CLOUDINARY_SECURE,
  });

  configured = true;
  logger.info('Cloudinary configured from CLOUDINARY_URL', {
    cloudName: creds.cloudName,
    folder: env.CLOUDINARY_FOLDER,
  });

  return cloudinary;
}

/**
 * @returns {boolean}
 */
export function isCloudinaryConfigured() {
  return Boolean(parseCloudinaryUrl(env.CLOUDINARY_URL));
}

export const cloudinaryConfig = Object.freeze({
  get cloudName() {
    return parseCloudinaryUrl()?.cloudName || '';
  },
  folder: env.CLOUDINARY_FOLDER,
  secure: env.CLOUDINARY_SECURE,
});

export { cloudinary };
export default {
  configureCloudinary,
  isCloudinaryConfigured,
  parseCloudinaryUrl,
  cloudinary,
  cloudinaryConfig,
};
