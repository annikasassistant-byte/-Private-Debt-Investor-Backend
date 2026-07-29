import type { Types, Document, Model } from 'mongoose';
import type { SoftDeleteFields } from './common.js';

export interface LoginHistoryEntry {
  ip?: string;
  userAgent?: string;
  at?: Date;
  deviceId?: string;
}

export interface DeviceEntry {
  deviceId: string;
  name?: string;
  lastUsed?: Date;
  refreshTokenId?: string | null;
}

export interface IPermission extends SoftDeleteFields {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  resource: string;
  action: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRole extends SoftDeleteFields {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  permissions: Types.ObjectId[] | IPermission[];
  isSystem?: boolean;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUser extends SoftDeleteFields {
  _id: Types.ObjectId;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
  role: Types.ObjectId | IRole;
  permissions?: Types.ObjectId[] | IPermission[];
  emailVerified?: boolean;
  phoneVerified?: boolean;
  phone?: string | null;
  isActive?: boolean;
  isLocked?: boolean;
  lockUntil?: Date | null;
  loginAttempts?: number;
  lastLogin?: Date | null;
  loginHistory?: LoginHistoryEntry[];
  devices?: DeviceEntry[];
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  passwordChangedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  fullName?: string;
  correctPassword?(candidate: string): Promise<boolean>;
  changedPasswordAfter?(jwtIat: number): boolean;
  incrementLoginAttempts?(): Promise<void>;
  resetLoginAttempts?(): Promise<void>;
  isAccountLocked?(): boolean;
  pushLoginHistory?(entry: LoginHistoryEntry): void;
  upsertDevice?(device: DeviceEntry): void;
  toObject?(options?: Record<string, unknown>): Record<string, unknown>;
  save?(options?: Record<string, unknown>): Promise<IUser>;
  $locals?: { actor?: string | null; [key: string]: unknown };
}

export type UserDocument = Document<Types.ObjectId> & IUser;
export type RoleDocument = Document<Types.ObjectId> & IRole;
export type PermissionDocument = Document<Types.ObjectId> & IPermission;

export type UserModel = Model<IUser>;
export type RoleModel = Model<IRole>;
export type PermissionModel = Model<IPermission>;

export interface IRefreshToken extends SoftDeleteFields {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  deviceId?: string | null;
  family?: string;
  expiresAt: Date;
  revoked?: boolean;
  revokedAt?: Date | null;
  replacedByToken?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAuditLog {
  _id: Types.ObjectId;
  actor?: Types.ObjectId | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
