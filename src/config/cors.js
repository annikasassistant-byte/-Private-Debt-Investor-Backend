import env from './env.js';

/**
 * Parse a comma-separated origin list into an array (or reflect all with `*`).
 * @param {string} value
 * @returns {string[] | boolean | string}
 */
function parseOrigins(value) {
  if (!value || value === '*') {
    return true;
  }

  const origins = value
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origins.length === 1) {
    return origins[0];
  }

  return origins;
}

const allowedOrigins = parseOrigins(env.CORS_ORIGIN);

/**
 * Dynamic origin callback — allows configured origins and reflection when `*`.
 * @param {string | undefined} origin
 * @param {(err: Error | null, allow?: boolean) => void} callback
 */
function originCallback(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (allowedOrigins === true) {
    callback(null, true);
    return;
  }

  const list = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];

  if (list.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS: origin "${origin}" is not allowed`));
}

/**
 * CORS options for Express `cors()` middleware.
 * @type {import('cors').CorsOptions}
 */
export const corsOptions = {
  origin: allowedOrigins === true ? true : originCallback,
  credentials: env.CORS_CREDENTIALS,
  methods: env.CORS_METHODS.split(',').map((m) => m.trim()),
  allowedHeaders: env.CORS_ALLOWED_HEADERS.split(',').map((h) => h.trim()),
  exposedHeaders: env.CORS_EXPOSED_HEADERS.split(',').map((h) => h.trim()),
  maxAge: env.CORS_MAX_AGE,
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

export const corsConfig = Object.freeze({
  origins: allowedOrigins,
  credentials: env.CORS_CREDENTIALS,
  methods: corsOptions.methods,
  allowedHeaders: corsOptions.allowedHeaders,
  exposedHeaders: corsOptions.exposedHeaders,
  maxAge: env.CORS_MAX_AGE,
});

export default corsOptions;
