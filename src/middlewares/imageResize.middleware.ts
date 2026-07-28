import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../config/logger.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

/**
 * Resize uploaded images with sharp (memory or disk).
 *
 * @param {{
 *   width?: number,
 *   height?: number,
 *   fit?: import('sharp').FitEnum[keyof import('sharp').FitEnum],
 *   quality?: number,
 *   format?: 'jpeg'|'png'|'webp'|'avif',
 *   field?: string,
 * }} [options]
 * @returns {import('express').RequestHandler}
 */
export function imageResize(options = {}) {
  const {
    width = 512,
    height = 512,
    fit = 'cover',
    quality = 80,
    format = 'webp',
    field = null,
  } = options;

  return asyncHandler(async (req, _res, next) => {
    const files = [];

    if (req.file) files.push(req.file);
    if (Array.isArray(req.files)) files.push(...req.files);
    else if (req.files && typeof req.files === 'object') {
      for (const list of Object.values(req.files)) {
        if (Array.isArray(list)) files.push(...list);
      }
    }

    const targets = field ? files.filter((f) => f.fieldname === field) : files;

    for (const file of targets) {
      if (!IMAGE_MIME.has(file.mimetype)) continue;

      try {
        let pipeline = sharp(file.buffer || file.path).resize({
          width,
          height,
          fit,
          withoutEnlargement: true,
        });

        if (format === 'jpeg') pipeline = pipeline.jpeg({ quality });
        else if (format === 'png') pipeline = pipeline.png({ quality });
        else if (format === 'avif') pipeline = pipeline.avif({ quality });
        else pipeline = pipeline.webp({ quality });

        const output = await pipeline.toBuffer();

        if (file.buffer) {
          file.buffer = output;
          file.size = output.length;
          file.mimetype = `image/${format === 'jpeg' ? 'jpeg' : format}`;
          const base = path.basename(file.originalname, path.extname(file.originalname));
          file.originalname = `${base}.${format === 'jpeg' ? 'jpg' : format}`;
        } else if (file.path) {
          const newPath = file.path.replace(path.extname(file.path), `.${format === 'jpeg' ? 'jpg' : format}`);
          await fs.writeFile(newPath, output);
          if (newPath !== file.path) {
            await fs.unlink(file.path).catch(() => {});
            file.path = newPath;
            file.filename = path.basename(newPath);
          }
          file.size = output.length;
          file.mimetype = `image/${format === 'jpeg' ? 'jpeg' : format}`;
        }

        file.resized = true;
      } catch (err) {
        logger.error('imageResize failed', { message: err.message });
        throw new ApiError(
          'Failed to process uploaded image',
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.UPLOAD_ERROR,
        );
      }
    }

    next();
  });
}

/** Avatar preset: 256×256 webp. */
export const resizeAvatar = imageResize({ width: 256, height: 256, format: 'webp', quality: 85 });

export const imageResizeMiddleware = imageResize;
export default imageResize;
