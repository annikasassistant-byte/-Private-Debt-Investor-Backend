import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import duration from 'dayjs/plugin/duration.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

export { dayjs };

/**
 * @param {string|number|Date|dayjs.Dayjs} [value]
 * @returns {dayjs.Dayjs}
 */
export function now(value) {
  return value === undefined ? dayjs() : dayjs(value);
}

/**
 * @param {string|number|Date|dayjs.Dayjs} value
 * @param {string} [format='YYYY-MM-DD HH:mm:ss']
 * @returns {string}
 */
export function formatDate(value, format = 'YYYY-MM-DD HH:mm:ss') {
  return dayjs(value).format(format);
}

/**
 * @param {string|number|Date|dayjs.Dayjs} value
 * @returns {string}
 */
export function toISO(value) {
  return dayjs(value).toISOString();
}

/**
 * @param {string|number|Date|dayjs.Dayjs} value
 * @returns {string}
 */
export function fromNow(value) {
  return dayjs(value).fromNow();
}

/**
 * @param {string|number|Date|dayjs.Dayjs} value
 * @param {string|number|Date|dayjs.Dayjs} [compareTo]
 * @returns {boolean}
 */
export function isExpired(value, compareTo = dayjs()) {
  return dayjs(value).isBefore(dayjs(compareTo));
}

/**
 * @param {number} amount
 * @param {import('dayjs').ManipulateType} unit
 * @param {string|number|Date|dayjs.Dayjs} [from]
 * @returns {Date}
 */
export function addTime(amount, unit, from = dayjs()) {
  return dayjs(from).add(amount, unit).toDate();
}

/**
 * @param {number} amount
 * @param {import('dayjs').ManipulateType} unit
 * @param {string|number|Date|dayjs.Dayjs} [from]
 * @returns {Date}
 */
export function subtractTime(amount, unit, from = dayjs()) {
  return dayjs(from).subtract(amount, unit).toDate();
}

/**
 * Parse duration strings like "15m", "7d", "1h" into milliseconds.
 * @param {string|number} value
 * @returns {number}
 */
export function parseDurationMs(value) {
  if (typeof value === 'number') {
    return value;
  }

  const match = String(value)
    .trim()
    .match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d|w)?$/i);

  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number.parseFloat(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();

  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };

  return Math.round(amount * multipliers[unit]);
}

/**
 * Start / end of day helpers (UTC).
 */
export function startOfDay(value = dayjs()) {
  return dayjs(value).utc().startOf('day').toDate();
}

export function endOfDay(value = dayjs()) {
  return dayjs(value).utc().endOf('day').toDate();
}

export default {
  dayjs,
  now,
  formatDate,
  toISO,
  fromNow,
  isExpired,
  addTime,
  subtractTime,
  parseDurationMs,
  startOfDay,
  endOfDay,
};
