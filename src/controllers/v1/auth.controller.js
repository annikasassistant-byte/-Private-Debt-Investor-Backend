import env from '../../config/env.js';
import { container } from '../../di/container.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { MESSAGES } from '../../constants/messages.js';
import { extractAccessToken } from '../../middlewares/auth.middleware.js';
import { issueCsrfToken } from '../../middlewares/csrf.middleware.js';

/**
 * @param {import('express').Request} req
 */
function requestContext(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.get('user-agent'),
    deviceId: req.body?.deviceId || req.headers['x-device-id'],
    deviceName: req.body?.deviceName || req.headers['x-device-name'],
  };
}

/**
 * @param {import('express').Response} res
 * @param {{ accessToken?: string, refreshToken?: string }} tokens
 */
function setAuthCookies(res, tokens) {
  const common = {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
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

/**
 * @param {import('express').Response} res
 */
function clearAuthCookies(res) {
  const common = {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    path: env.COOKIE_PATH,
  };
  res.clearCookie(env.ACCESS_COOKIE_NAME, common);
  res.clearCookie(env.REFRESH_COOKIE_NAME, common);
}

export const register = asyncHandler(async (req, res) => {
  const result = await container.authService.register(req.body, requestContext(req));
  setAuthCookies(res, result);
  issueCsrfToken(res);
  return ApiResponse.created(res, result, MESSAGES.CREATED);
});

export const login = asyncHandler(async (req, res) => {
  const result = await container.authService.login(req.body, requestContext(req));
  setAuthCookies(res, result);
  issueCsrfToken(res);
  return ApiResponse.ok(res, result, MESSAGES.SUCCESS);
});

export const logout = asyncHandler(async (req, res) => {
  const accessToken = extractAccessToken(req) || req.accessToken;
  const refreshToken =
    req.body?.refreshToken || req.cookies?.[env.REFRESH_COOKIE_NAME] || null;

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

export const logoutAll = asyncHandler(async (req, res) => {
  const accessToken = extractAccessToken(req) || req.accessToken;
  await container.authService.logoutAll(
    req.user._id || req.user.id,
    { accessToken },
    requestContext(req),
  );
  clearAuthCookies(res);
  return ApiResponse.ok(res, { success: true }, MESSAGES.SUCCESS);
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken =
    req.body?.refreshToken || req.cookies?.[env.REFRESH_COOKIE_NAME] || null;

  const result = await container.authService.refreshAccessToken(
    refreshToken,
    requestContext(req),
  );

  setAuthCookies(res, result);
  return ApiResponse.ok(res, result, MESSAGES.SUCCESS);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await container.authService.forgotPassword(req.body.email, requestContext(req));
  return ApiResponse.ok(res, result, MESSAGES.PASSWORD_RESET_SENT);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await container.authService.resetPassword(
    { token: req.body.token, password: req.body.password },
    requestContext(req),
  );
  clearAuthCookies(res);
  return ApiResponse.ok(res, result, MESSAGES.PASSWORD_CHANGED);
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const token = req.body?.token || req.query?.token;
  const result = await container.authService.verifyEmail(token, requestContext(req));
  return ApiResponse.ok(res, result, MESSAGES.SUCCESS);
});

export const resendVerification = asyncHandler(async (req, res) => {
  const result = await container.authService.resendVerification(
    req.body.email,
    requestContext(req),
  );
  return ApiResponse.ok(res, result, MESSAGES.EMAIL_SENT);
});

export const changePassword = asyncHandler(async (req, res) => {
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

export default {
  register,
  login,
  logout,
  logoutAll,
  refresh,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  changePassword,
};
