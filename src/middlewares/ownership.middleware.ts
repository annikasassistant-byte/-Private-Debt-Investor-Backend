import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { ROLES } from '../enums/roles.js';
import Investor from '../models/investor.model.js';

function roleSlug(user: any): string | null {
  if (!user) return null;
  if (typeof user.role === 'string') return user.role;
  return user.role?.slug || null;
}

export function isAdminUser(user: any): boolean {
  return roleSlug(user) === ROLES.ADMIN;
}

/** Load Investor profile for authenticated investor users onto req.investor */
export const attachInvestorProfile: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    if (isAdminUser(req.user)) return next();

    const investor = await Investor.findOne({ user: req.user._id || req.user.id });
    if (!investor) {
      return next(ApiError.forbidden('Investor profile not found for this account'));
    }
    (req as any).investor = investor;
    return next();
  } catch (err) {
    return next(err);
  }
};

export function requireOwnInvestor(
  getInvestorId: (req: Request) => string | null | undefined,
): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    if (isAdminUser(req.user)) return next();

    const ownId = String((req as any).investor?._id || '');
    const targetId = String(getInvestorId(req) || '');
    if (!ownId || !targetId || ownId !== targetId) {
      return next(ApiError.forbidden('You can only access your own data'));
    }
    return next();
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
  if (!isAdminUser(req.user)) return next(ApiError.forbidden(MESSAGES.FORBIDDEN));
  return next();
}
