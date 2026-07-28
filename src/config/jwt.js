import env from './env.js';

/**
 * JWT configuration constants derived from validated environment.
 */
export const jwtConfig = Object.freeze({
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES,
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
  algorithm: 'HS256',
  accessCookieName: env.ACCESS_COOKIE_NAME,
  refreshCookieName: env.REFRESH_COOKIE_NAME,
});

/**
 * Base sign options for access tokens.
 */
export const accessTokenSignOptions = Object.freeze({
  expiresIn: jwtConfig.accessExpiresIn,
  issuer: jwtConfig.issuer,
  audience: jwtConfig.audience,
  algorithm: jwtConfig.algorithm,
});

/**
 * Base sign options for refresh tokens.
 */
export const refreshTokenSignOptions = Object.freeze({
  expiresIn: jwtConfig.refreshExpiresIn,
  issuer: jwtConfig.issuer,
  audience: jwtConfig.audience,
  algorithm: jwtConfig.algorithm,
});

/**
 * Base verify options shared by both token types.
 */
export const tokenVerifyOptions = Object.freeze({
  issuer: jwtConfig.issuer,
  audience: jwtConfig.audience,
  algorithms: [jwtConfig.algorithm],
});

export default jwtConfig;
