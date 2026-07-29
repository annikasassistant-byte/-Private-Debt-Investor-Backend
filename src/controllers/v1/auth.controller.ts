import type { CookieOptions, Request, Response } from 'express';
import env from '../../config/env.js';
import { container } from '../../di/container.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { MESSAGES } from '../../constants/messages.js';
import { extractAccessToken } from '../../middlewares/auth.middleware.js';
import { issueCsrfToken } from '../../middlewares/csrf.middleware.js';
import type { RequestContext } from '../../types/common.js';

function requestContext(req: Request): RequestContext {
  return {
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.get('user-agent'),
    deviceId: (req.body?.deviceId || req.headers['x-device-id']) as string | null | undefined,
    deviceName: (req.body?.deviceName || req.headers['x-device-name']) as string | null | undefined,
  };
}

function setAuthCookies(
  res: Response,
  tokens: { accessToken?: string; refreshToken?: string },
): void {
  const common: CookieOptions = {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE as CookieOptions['sameSite'],
    domain: env.COOKIE_DOMAIN,
    path: env.COOKIE_PATH,
  };

  if (tokens.accessToken) {
    res.cookie(env.ACCESS_COOKIE_NAME, tokens.accessToken, {
      ...common,
      maxAge: env.COOKIE_MAX_AGE_MS,
    });
  }

  if (tokens.refreshToken) {
    res.cookie(env.REFRESH_COOKIE_NAME, tokens.refreshToken, {
      ...common,
      maxAge: env.COOKIE_MAX_AGE_MS,
    });
  }
}

function clearAuthCookies(res: Response): void {
  const common: CookieOptions = {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE as CookieOptions['sameSite'],
    domain: env.COOKIE_DOMAIN,
    path: env.COOKIE_PATH,
  };
  res.clearCookie(env.ACCESS_COOKIE_NAME, common);
  res.clearCookie(env.REFRESH_COOKIE_NAME, common);
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await container.authService.register(req.body, requestContext(req));
  setAuthCookies(res, result);
  issueCsrfToken(res);
  return ApiResponse.created(res, result, MESSAGES.CREATED);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await container.authService.login(req.body, requestContext(req));
  setAuthCookies(res, result);
  issueCsrfToken(res);
  return ApiResponse.ok(res, result, MESSAGES.SUCCESS);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const accessToken = extractAccessToken(req) || req.accessToken;
  const refreshToken = req.body?.refreshToken || req.cookies?.[env.REFRESH_COOKIE_NAME] || null;

  await container.authService.logout(
    {
      accessToken,
      refreshToken,
      userId: req.user?._id || req.user?.id,
    },
    requestContext(req),
  );

  clearAuthCookies(res);
  return ApiResponse.ok(res, { success: true }, MESSAGES.SUCCESS);
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  const accessToken = extractAccessToken(req) || req.accessToken;
  await container.authService.logoutAll(
    req.user._id || req.user.id,
    { accessToken },
    requestContext(req),
  );
  clearAuthCookies(res);
  return ApiResponse.ok(res, { success: true }, MESSAGES.SUCCESS);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.body?.refreshToken || req.cookies?.[env.REFRESH_COOKIE_NAME] || null;

  const result = await container.authService.refreshAccessToken(refreshToken, requestContext(req));

  setAuthCookies(res, result);
  return ApiResponse.ok(res, result, MESSAGES.SUCCESS);
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await container.authService.forgotPassword(req.body.email, requestContext(req));
  return ApiResponse.ok(res, result, MESSAGES.OTP_SENT);
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await container.authService.verifyPasswordResetOtp(
    { email: req.body.email, otp: req.body.otp },
    requestContext(req),
  );
  return ApiResponse.ok(res, result, MESSAGES.OTP_VERIFIED);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await container.authService.resetPassword(
    {
      token: req.body.token,
      resetToken: req.body.resetToken,
      password: req.body.password,
      email: req.body.email,
      otp: req.body.otp,
    },
    requestContext(req),
  );
  clearAuthCookies(res);
  return ApiResponse.ok(res, result, MESSAGES.PASSWORD_CHANGED);
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const token = req.body?.token || req.query?.token;
  const result = await container.authService.verifyEmail(token, requestContext(req));
  return ApiResponse.ok(res, result, MESSAGES.SUCCESS);
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const result = await container.authService.resendVerification(
    req.body.email,
    requestContext(req),
  );
  return ApiResponse.ok(res, result, MESSAGES.EMAIL_SENT);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await container.authService.changePassword(
    req.user._id || req.user.id,
    {
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    },
    requestContext(req),
  );
  clearAuthCookies(res);
  return ApiResponse.ok(res, result, MESSAGES.PASSWORD_CHANGED);
});

export const registerAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await container.adminBootstrapService.registerAdmin(
    {
      email: req.body.email || process.env.ADMIN_EMAIL,
      password: req.body.password || process.env.ADMIN_PASSWORD,
      firstName: req.body.firstName || process.env.ADMIN_FIRST_NAME,
      lastName: req.body.lastName || process.env.ADMIN_LAST_NAME,
      force: req.body.force || process.env.ADMIN_FORCE,
      roleSlug: req.body.roleSlug || process.env.ADMIN_ROLE_SLUG,
    },
    requestContext(req),
  );
  if (result.created) {
    return ApiResponse.created(res, result, MESSAGES.CREATED);
  }
  return ApiResponse.ok(res, result, MESSAGES.ADMIN_REGISTERED);
});

export default {
  register,
  login,
  logout,
  logoutAll,
  refresh,
  forgotPassword,
  verifyOtp,
  resetPassword,
  verifyEmail,
  resendVerification,
  changePassword,
  registerAdmin,
};
