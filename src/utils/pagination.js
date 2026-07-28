import env from '../config/env.js';

/**
 * Parse pagination query params with sane defaults and caps.
 * @param {object} query
 * @param {string|number} [query.page]
 * @param {string|number} [query.limit]
 * @param {string} [query.sort]
 * @param {string} [query.order]
 * @returns {{ page: number, limit: number, skip: number, sort: string, order: 'asc'|'desc', sortBy: Record<string, 1|-1> }}
 */
export function parsePagination(query = {}) {
  const page = Math.max(
    1,
    Number.parseInt(String(query.page ?? env.PAGINATION_DEFAULT_PAGE), 10) || 1,
  );

  let limit =
    Number.parseInt(String(query.limit ?? env.PAGINATION_DEFAULT_LIMIT), 10) ||
    env.PAGINATION_DEFAULT_LIMIT;

  limit = Math.min(Math.max(1, limit), env.PAGINATION_MAX_LIMIT);

  const sort = typeof query.sort === 'string' && query.sort.trim() ? query.sort.trim() : 'createdAt';
  const order = String(query.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    sort,
    order,
    sortBy: { [sort]: order === 'asc' ? 1 : -1 },
  };
}

/**
 * Build pagination metadata for list responses.
 * @param {{ page: number, limit: number, total: number }} params
 * @returns {{ page: number, limit: number, total: number, totalPages: number, hasNextPage: boolean, hasPrevPage: boolean }}
 */
export function buildPaginationMeta({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Apply pagination to a Mongoose query and return results + meta.
 * @param {import('mongoose').Query} query
 * @param {ReturnType<typeof parsePagination>} pagination
 * @param {import('mongoose').FilterQuery<any>} [countFilter]
 * @returns {Promise<{ data: unknown[], meta: ReturnType<typeof buildPaginationMeta> }>}
 */
export async function paginateQuery(query, pagination, countFilter) {
  const model = query.model;
  const filter = countFilter ?? query.getFilter();

  const [data, total] = await Promise.all([
    query
      .sort(pagination.sortBy)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .exec(),
    model.countDocuments(filter),
  ]);

  return {
    data,
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
}

export default {
  parsePagination,
  buildPaginationMeta,
  paginateQuery,
};
