import type { Request } from 'express';

export type AuthUser = {
  _id?: string;
  id?: string;
  email?: string;
  role?: unknown;
  permissions?: string[];
  [key: string]: unknown;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
      requestTime?: Date;
      startTime?: bigint;
      durationMs?: number;
      file?: Express.Multer.File;
      files?:
        | Express.Multer.File[]
        | { [fieldname: string]: Express.Multer.File[] };
    }
  }
}

export {};
