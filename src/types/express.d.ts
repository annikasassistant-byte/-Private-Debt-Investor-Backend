import type { Request } from 'express';
import type { JwtAccessPayload } from './common.js';
import type { IUser, IRole, IPermission } from './models.js';

export type AuthUser = Partial<IUser> & {
  _id?: string | import('mongoose').Types.ObjectId;
  id?: string;
  email?: string;
  role?: string | IRole | import('mongoose').Types.ObjectId | null;
  permissions?: string[] | IPermission[] | import('mongoose').Types.ObjectId[];
  /** Permission slugs copied from JWT payload during authorization checks. */
  tokenPermissions?: string[];
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      accessToken?: string;
      tokenPayload?: JwtAccessPayload;
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

export type AuthenticatedRequest = Request & {
  user: AuthUser;
  accessToken?: string;
  tokenPayload?: JwtAccessPayload;
};

export {};
