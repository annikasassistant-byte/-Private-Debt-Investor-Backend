import { describe, it, expect } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/depth_dashboard_test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-characters!';
process.env.COOKIE_SECRET =
  process.env.COOKIE_SECRET || 'test-cookie-secret-min-32-characters!!';
process.env.PAGINATION_DEFAULT_PAGE = '1';
process.env.PAGINATION_DEFAULT_LIMIT = '20';
process.env.PAGINATION_MAX_LIMIT = '100';

const { parsePagination, buildPaginationMeta } = await import('../../utils/pagination.js');

describe('pagination util', () => {
  it('applies defaults', () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.skip).toBe(0);
    expect(result.sort).toBe('createdAt');
    expect(result.order).toBe('desc');
    expect(result.sortBy).toEqual({ createdAt: -1 });
  });

  it('parses page, limit, sort, and order', () => {
    const result = parsePagination({ page: '2', limit: '10', sort: 'email', order: 'asc' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.skip).toBe(10);
    expect(result.sort).toBe('email');
    expect(result.order).toBe('asc');
    expect(result.sortBy).toEqual({ email: 1 });
  });

  it('caps limit at max', () => {
    const result = parsePagination({ limit: '9999' });
    expect(result.limit).toBe(100);
  });

  it('floors invalid page/limit to sane values', () => {
    const result = parsePagination({ page: '-5', limit: '0' });
    expect(result.page).toBe(1);
    expect(result.limit).toBeGreaterThanOrEqual(1);
  });

  it('builds pagination meta', () => {
    const meta = buildPaginationMeta({ page: 2, limit: 10, total: 35 });
    expect(meta).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      totalPages: 4,
      hasNextPage: true,
      hasPrevPage: true,
    });
  });

  it('meta has no next on last page', () => {
    const meta = buildPaginationMeta({ page: 4, limit: 10, total: 35 });
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPrevPage).toBe(true);
  });
});
