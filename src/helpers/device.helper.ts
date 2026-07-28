import crypto from 'node:crypto';

/**
 * @typedef {object} ParsedDevice
 * @property {string} deviceId
 * @property {string} name
 * @property {string} [browser]
 * @property {string} [os]
 * @property {string} [deviceType]
 * @property {string} [rawUserAgent]
 */

/**
 * Generate a stable-looking device id when the client does not send one.
 * @returns {string}
 */
export function generateDeviceId() {
  return crypto.randomUUID();
}

/**
 * Lightweight UA parsing without extra dependencies.
 * Good enough for audit logs / device lists — not a full bot detector.
 * @param {string} [userAgent]
 * @returns {{ browser: string, os: string, deviceType: 'desktop'|'mobile'|'tablet'|'bot'|'unknown' }}
 */
export function parseUserAgent(userAgent = '') {
  const ua = String(userAgent || '').trim();
  if (!ua) {
    return { browser: 'Unknown', os: 'Unknown', deviceType: 'unknown' };
  }

  const lower = ua.toLowerCase();

  let deviceType = 'desktop';
  if (/bot|crawl|spider|slurp|bingpreview/i.test(ua)) {
    deviceType = 'bot';
  } else if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
    deviceType = 'mobile';
  }

  let os = 'Unknown';
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/cros/i.test(ua)) os = 'Chrome OS';

  let browser = 'Unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/chrome|crios/i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios|android/i.test(lower)) browser = 'Safari';
  else if (/msie|trident/i.test(ua)) browser = 'IE';

  return { browser, os, deviceType };
}

/**
 * Build a human-readable device name.
 * @param {{ browser?: string, os?: string, deviceType?: string }} parsed
 * @returns {string}
 */
export function formatDeviceName(parsed = {}) {
  const parts = [parsed.browser, parsed.os].filter(Boolean);
  const base = parts.length ? parts.join(' on ') : 'Unknown device';
  if (parsed.deviceType && parsed.deviceType !== 'desktop' && parsed.deviceType !== 'unknown') {
    return `${base} (${parsed.deviceType})`;
  }
  return base;
}

/**
 * Resolve device metadata from request-like inputs.
 * @param {{
 *   deviceId?: string,
 *   userAgent?: string,
 *   headers?: Record<string, string | string[] | undefined>,
 * }} [input]
 * @returns {ParsedDevice}
 */
export function resolveDevice(input = {}) {
  const headers = input.headers || {};
  const headerUa = headers['user-agent'] || headers['User-Agent'];
  const userAgent =
    input.userAgent ||
    (Array.isArray(headerUa) ? headerUa[0] : headerUa) ||
    '';

  const headerDeviceId = headers['x-device-id'] || headers['X-Device-Id'];
  const deviceId =
    (typeof input.deviceId === 'string' && input.deviceId.trim()) ||
    (Array.isArray(headerDeviceId) ? headerDeviceId[0] : headerDeviceId) ||
    generateDeviceId();

  const parsed = parseUserAgent(userAgent);

  return {
    deviceId: String(deviceId).trim(),
    name: formatDeviceName(parsed),
    browser: parsed.browser,
    os: parsed.os,
    deviceType: parsed.deviceType,
    rawUserAgent: String(userAgent).slice(0, 512),
  };
}

export default {
  generateDeviceId,
  parseUserAgent,
  formatDeviceName,
  resolveDevice,
};
