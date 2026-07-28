import xss from 'xss';

/**
 * Recursively sanitize strings against XSS.
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizeValue(value) {
  if (typeof value === 'string') {
    return xss(value, {
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style'],
    });
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = sanitizeValue(val);
    }
    return out;
  }

  return value;
}

/**
 * Sanitize req.body, req.query, and req.params against XSS.
 * @type {import('express').RequestHandler}
 */
export function xssMiddleware(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    const cleaned = sanitizeValue(req.query);
    // Express 5 query may be read-only; mutate keys in place when possible
    try {
      for (const key of Object.keys(req.query)) {
        delete req.query[key];
      }
      Object.assign(req.query, cleaned);
    } catch {
      req.sanitizedQuery = cleaned;
    }
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params);
  }

  next();
}

export default xssMiddleware;
