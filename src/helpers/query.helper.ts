import mongoose from 'mongoose';
import { parsePagination } from '../utils/pagination.js';

/**
 * Escape regex special characters for safe `$regex` usage.
 * @param {string} value
 * @returns {string}
 */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Coerce common query string scalars.
 * @param {unknown} value
 * @returns {unknown}
 */
function coerceValue(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isNaN(n)) return n;
  }
  if (mongoose.isValidObjectId(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

/**
 * Build a Mongo filter from Express-style query params.
 *
 * Supported:
 * - `search` / `q` — OR regex across `searchFields`
 * - `filter[field]=value` or flat `field=value` for allow-listed keys
 * - `sort` + `order` (via parsePagination) or `sort=-createdAt,email`
 *
 * @param {Record<string, unknown>} query
 * @param {{
 *   searchFields?: string[],
 *   allowedFilters?: string[],
 *   defaultSort?: string,
 * }} [options]
 * @returns {{
 *   filter: Record<string, unknown>,
 *   sortBy: Record<string, 1|-1>,
 *   pagination: ReturnType<typeof parsePagination>,
 * }}
 */
export function buildMongoQuery(query = {}, options = {}) {
  const {
    searchFields = ['email', 'firstName', 'lastName'],
    allowedFilters = ['isActive', 'emailVerified', 'role', 'status'],
    defaultSort = 'createdAt',
  } = options;

  /** @type {Record<string, unknown>} */
  const filter = {};

  const searchRaw = query.search ?? query.q;
  if (typeof searchRaw === 'string' && searchRaw.trim() && searchFields.length) {
    const pattern = escapeRegex(searchRaw.trim());
    filter.$or = searchFields.map((field) => ({
      [field]: { $regex: pattern, $options: 'i' },
    }));
  }

  const nestedFilter =
    query.filter && typeof query.filter === 'object' && !Array.isArray(query.filter)
      ? query.filter
      : {};

  for (const key of allowedFilters) {
    const raw = nestedFilter[key] ?? query[key];
    const value = coerceValue(raw);
    if (value === undefined) continue;

    if (key === 'role' && typeof value === 'string' && mongoose.isValidObjectId(value)) {
      filter.role = new mongoose.Types.ObjectId(value);
    } else {
      filter[key] = value;
    }
  }

  // Date range helpers: createdFrom / createdTo
  const createdFrom = coerceValue(query.createdFrom);
  const createdTo = coerceValue(query.createdTo);
  if (createdFrom || createdTo) {
    filter.createdAt = {};
    if (createdFrom) filter.createdAt.$gte = new Date(String(createdFrom));
    if (createdTo) filter.createdAt.$lte = new Date(String(createdTo));
  }

  const pagination = parsePagination({
    page: query.page,
    limit: query.limit,
    sort: query.sort || defaultSort,
    order: query.order,
  });

  // Support comma-separated multi-sort: sort=-createdAt,email
  let sortBy = pagination.sortBy;
  if (typeof query.sort === 'string' && query.sort.includes(',')) {
    sortBy = {};
    for (const part of query.sort.split(',')) {
      const token = part.trim();
      if (!token) continue;
      if (token.startsWith('-')) {
        sortBy[token.slice(1)] = -1;
      } else if (token.startsWith('+')) {
        sortBy[token.slice(1)] = 1;
      } else {
        sortBy[token] = pagination.order === 'asc' ? 1 : -1;
      }
    }
  }

  return { filter, sortBy, pagination: { ...pagination, sortBy } };
}

export default {
  escapeRegex,
  buildMongoQuery,
};
