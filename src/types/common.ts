/**
 * Shared domain / API TypeScript types for Depth Dashboard server.
 */

export type ObjectIdLike = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string | Record<string, 1 | -1>;
  search?: string;
  searchFields?: string[];
}

export interface PaginationQueryInput {
  page?: string | number;
  limit?: string | number;
  sort?: string;
  order?: string;
  [key: string]: unknown;
}

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
  sort: string;
  order: 'asc' | 'desc';
  sortBy: Record<string, 1 | -1>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ListPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
  meta?: unknown;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: unknown;
  errorCode?: string;
  stack?: string;
  timestamp?: string;
}

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  requestId?: string | null;
}

export interface JwtAccessPayload {
  sub: string;
  /** Legacy claim — prefer `sub`. */
  userId?: string;
  email?: string;
  role?: string | unknown;
  permissions?: string[];
  jti?: string;
  type?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

export interface JwtRefreshPayload {
  sub: string;
  deviceId?: string | null;
  family?: string;
  jti?: string;
  type?: string;
  iat?: number;
  exp?: number;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  roleId?: string | null;
  roleSlug?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
  deviceId?: string | null;
  deviceName?: string | null;
}

export interface TokenPairResult {
  token: string;
  hashed: string;
  expiresAt: Date;
}

export interface OtpWithExpiry {
  otp: string;
  hashed: string;
  expiresAt: Date;
}

export interface SignedTokenResult {
  token: string;
  jti: string;
  expiresIn: string | number;
}

export interface SignedTokenPairResult {
  accessToken: string;
  refreshToken: string;
  accessJti: string;
  refreshJti: string;
  accessExpiresIn: string | number;
  refreshExpiresIn: string | number;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface SoftDeleteFields {
  isDeleted?: boolean;
  deletedAt?: Date | null;
  deletedBy?: ObjectIdLike | null;
  createdBy?: ObjectIdLike | null;
  updatedBy?: ObjectIdLike | null;
}

export interface RepositoryOptions {
  session?: import('mongoose').ClientSession;
  actor?: string | null;
  populate?: string | object | Array<string | object>;
  select?: string;
  includeDeleted?: boolean;
  lean?: boolean;
  sort?: string | Record<string, 1 | -1>;
  page?: number;
  limit?: number;
  search?: string;
  searchFields?: string[];
}
