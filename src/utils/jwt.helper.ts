import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
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
import type {
  JwtAccessPayload,
  JwtRefreshPayload,
  SignedTokenPairResult,
  SignedTokenResult,
} from '../types/common.js';

export type AccessTokenSignPayload = {
  sub: string;
  role?: string;
  permissions?: string[];
  email?: string;
  jti?: string;
  [key: string]: unknown;
};

export type RefreshTokenSignPayload = {
  sub: string;
  jti?: string;
  deviceId?: string | null;
  family?: string;
  [key: string]: unknown;
};

/**
 * Sign an access token.
 */
export function signAccessToken(
  payload: AccessTokenSignPayload,
  options: SignOptions = {},
): SignedTokenResult {
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
    } as SignOptions,
  );

  return { token, jti, expiresIn: options.expiresIn || jwtConfig.accessExpiresIn };
}

/**
 * Sign a refresh token.
 */
export function signRefreshToken(
  payload: RefreshTokenSignPayload,
  options: SignOptions = {},
): SignedTokenResult {
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
    } as SignOptions,
  );

  return { token, jti, expiresIn: options.expiresIn || jwtConfig.refreshExpiresIn };
}

/**
 * Sign both access and refresh tokens.
 */
export function signTokenPair(payload: AccessTokenSignPayload): SignedTokenPairResult {
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
 */
export function verifyAccessToken(token: string): JwtPayload & JwtAccessPayload {
  try {
    const decoded = jwt.verify(token, jwtConfig.accessSecret, tokenVerifyOptions) as JwtPayload &
      JwtAccessPayload & { type?: string };

    if (decoded.type && decoded.type !== TOKEN_TYPES.ACCESS) {
      throw new UnauthorizedException(MESSAGES.TOKEN_INVALID, ERROR_CODES.TOKEN_INVALID);
    }

    return decoded;
  } catch (error: unknown) {
    if (error instanceof UnauthorizedException) {
      throw error;
    }

    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw new UnauthorizedException(MESSAGES.TOKEN_EXPIRED, ERROR_CODES.TOKEN_EXPIRED);
    }

    throw new UnauthorizedException(MESSAGES.TOKEN_INVALID, ERROR_CODES.TOKEN_INVALID);
  }
}

/**
 * Verify a refresh token.
 */
export function verifyRefreshToken(token: string): JwtPayload & JwtRefreshPayload {
  try {
    const decoded = jwt.verify(token, jwtConfig.refreshSecret, tokenVerifyOptions) as JwtPayload &
      JwtRefreshPayload & { type?: string };

    if (decoded.type && decoded.type !== TOKEN_TYPES.REFRESH) {
      throw new UnauthorizedException(
        MESSAGES.REFRESH_TOKEN_INVALID,
        ERROR_CODES.TOKEN_INVALID,
      );
    }

    return decoded;
  } catch (error: unknown) {
    if (error instanceof UnauthorizedException) {
      throw error;
    }

    if (error instanceof Error && error.name === 'TokenExpiredError') {
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
 */
export function decodeToken(token: string): null | JwtPayload | string {
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
