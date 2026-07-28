import type { FilterQuery, Query } from 'mongoose';
import env from '../config/env.js';
import type {
  ListPaginationMeta,
  PaginationQueryInput,
  ParsedPagination,
} from '../types/common.js';

/**
 * Parse pagination query params with sane defaults and caps.
 */
export function parsePagination(query: PaginationQueryInput = {}): ParsedPagination {
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
 */
export function buildPaginationMeta({
  page,
  limit,
  total,
}: {
  page: number;
  limit: number;
  total: number;
}): ListPaginationMeta {
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
 */
export async function paginateQuery<T = unknown>(
  query: Query<T[], T>,
  pagination: ParsedPagination,
  countFilter?: FilterQuery<T>,
): Promise<{ data: T[]; meta: ListPaginationMeta }> {
  const model = query.model;
  const filter = countFilter ?? (query.getFilter() as FilterQuery<T>);

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
