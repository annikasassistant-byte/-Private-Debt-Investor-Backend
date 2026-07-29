import fs from 'node:fs/promises';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

type Signature = { mime: string; bytes: number[]; offset?: number; mask?: number[] };

/** Common magic-byte signatures for allowed upload types. */
const SIGNATURES: Signature[] = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF....WEBP checked below
  // ZIP-based: docx / xlsx / generic zip
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x05, 0x06] },
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x07, 0x08] },
];

const ZIP_MIMES = new Set([
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
]);

function matches(buf: Buffer, sig: Signature): boolean {
  const offset = sig.offset || 0;
  if (buf.length < offset + sig.bytes.length) return false;
  for (let i = 0; i < sig.bytes.length; i += 1) {
    if (buf[offset + i] !== sig.bytes[i]) return false;
  }
  return true;
}

function detectMime(buf: Buffer): string | null {
  if (
    buf.length >= 12 &&
    matches(
      buf,
      SIGNATURES.find((s) => s.mime === 'image/webp')!,
    ) &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  for (const sig of SIGNATURES) {
    if (sig.mime === 'image/webp') continue;
    if (matches(buf, sig)) return sig.mime;
  }
  return null;
}

function isCompatible(declared: string, detected: string | null): boolean {
  if (!detected) return false;
  const d = declared.toLowerCase();
  if (detected === 'application/pdf' && d === 'application/pdf') return true;
  if (detected.startsWith('image/') && d === detected) return true;
  if (detected === 'application/zip' && ZIP_MIMES.has(d)) return true;
  return false;
}

/**
 * After multer, verify file contents match declared MIME via magic bytes.
 * Works for disk (`path`) and memory (`buffer`) uploads.
 */
export function validateMagicBytes(fieldName = 'file') {
  return async (req: any, _res: any, next: any) => {
    try {
      const file =
        req.file ||
        (Array.isArray(req.files) ? req.files[0] : null) ||
        (req.files && req.files[fieldName] && req.files[fieldName][0]);

      if (!file) return next();

      let header: Buffer;
      if (file.buffer && Buffer.isBuffer(file.buffer)) {
        header = file.buffer.subarray(0, 32);
      } else if (file.path) {
        const fh = await fs.open(file.path, 'r');
        try {
          header = Buffer.alloc(32);
          await fh.read(header, 0, 32, 0);
        } finally {
          await fh.close();
        }
      } else {
        return next();
      }

      const detected = detectMime(header);
      if (!isCompatible(file.mimetype || '', detected)) {
        if (file.path) {
          await fs.unlink(file.path).catch(() => {});
        }
        return next(
          new ApiError(
            `File content does not match declared type "${file.mimetype}"`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.UPLOAD_ERROR,
          ),
        );
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export default validateMagicBytes;
