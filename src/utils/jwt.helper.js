import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  jwtConfig,
  accessTokenSignOptions,
  refreshTokenSignOptions,
  tokenVerifyOptions,
} from '../config/jwt.js';
import { TOKEN_TYPES } from '../enums/tokenTypes.js';
import { UnauthorizedException } from '../exceptions/UnauthorizedException.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { MESSAGES } from '../constants/messages.js';

/**
 * Sign an access token.
 * @param {{ sub: string, role?: string, permissions?: string[], [key: string]: unknown }} payload
 * @param {import('jsonwebtoken').SignOptions} [options]
 * @returns {{ token: string, jti: string, expiresIn: string }}
 */
export function signAccessToken(payload, options = {}) {
  const jti = payload.jti || uuidv4();
  const token = jwt.sign(
    {
      ...payload,
      jti,
      type: TOKEN_TYPES.ACCESS,
    },
    jwtConfig.accessSecret,
    {
      ...accessTokenSignOptions,
      ...options,
    },
  );

  return { token, jti, expiresIn: options.expiresIn || jwtConfig.accessExpiresIn };
}

/**
 * Sign a refresh token.
 * @param {{ sub: string, [key: string]: unknown }} payload
 * @param {import('jsonwebtoken').SignOptions} [options]
 * @returns {{ token: string, jti: string, expiresIn: string }}
 */
export function signRefreshToken(payload, options = {}) {
  const jti = payload.jti || uuidv4();
  const token = jwt.sign(
    {
      ...payload,
      jti,
      type: TOKEN_TYPES.REFRESH,
    },
    jwtConfig.refreshSecret,
    {
      ...refreshTokenSignOptions,
      ...options,
    },
  );

  return { token, jti, expiresIn: options.expiresIn || jwtConfig.refreshExpiresIn };
}

/**
 * Sign both access and refresh tokens.
 * @param {{ sub: string, role?: string, permissions?: string[], [key: string]: unknown }} payload
 * @returns {{ accessToken: string, refreshToken: string, accessJti: string, refreshJti: string }}
 */
export function signTokenPair(payload) {
  const access = signAccessToken(payload);
  const refresh = signRefreshToken({ sub: payload.sub });

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessJti: access.jti,
    refreshJti: refresh.jti,
    accessExpiresIn: access.expiresIn,
    refreshExpiresIn: refresh.expiresIn,
  };
}

/**
 * Verify an access token.
 * @param {string} token
 * @returns {jwt.JwtPayload}
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, jwtConfig.accessSecret, tokenVerifyOptions);

    if (decoded.type && decoded.type !== TOKEN_TYPES.ACCESS) {
      throw new UnauthorizedException(MESSAGES.TOKEN_INVALID, ERROR_CODES.TOKEN_INVALID);
    }

    return /** @type {jwt.JwtPayload} */ (decoded);
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      throw error;
    }

    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedException(MESSAGES.TOKEN_EXPIRED, ERROR_CODES.TOKEN_EXPIRED);
    }

    throw new UnauthorizedException(MESSAGES.TOKEN_INVALID, ERROR_CODES.TOKEN_INVALID);
  }
}

/**
 * Verify a refresh token.
 * @param {string} token
 * @returns {jwt.JwtPayload}
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, jwtConfig.refreshSecret, tokenVerifyOptions);

    if (decoded.type && decoded.type !== TOKEN_TYPES.REFRESH) {
      throw new UnauthorizedException(
        MESSAGES.REFRESH_TOKEN_INVALID,
        ERROR_CODES.TOKEN_INVALID,
      );
    }

    return /** @type {jwt.JwtPayload} */ (decoded);
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      throw error;
    }

    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedException(MESSAGES.TOKEN_EXPIRED, ERROR_CODES.TOKEN_EXPIRED);
    }

    throw new UnauthorizedException(
      MESSAGES.REFRESH_TOKEN_INVALID,
      ERROR_CODES.TOKEN_INVALID,
    );
  }
}

/**
 * Decode without verification (introspection / debugging).
 * @param {string} token
 * @returns {null | jwt.JwtPayload | string}
 */
export function decodeToken(token) {
  return jwt.decode(token);
}

export default {
  signAccessToken,
  signRefreshToken,
  signTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};
