import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { applyBaseModel } from './base.model.js';
import env from '../config/env.js';

const { Schema } = mongoose;

const loginHistorySchema = new Schema(
  {
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    at: { type: Date, default: Date.now },
    deviceId: { type: String, trim: true },
  },
  { _id: false },
);

const deviceSchema = new Schema(
  {
    deviceId: { type: String, required: true, trim: true },
    name: { type: String, trim: true, default: 'Unknown device' },
    lastUsed: { type: Date, default: Date.now },
    refreshTokenId: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const userSchema = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    maxlength: 255,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: 100,
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: 100,
  },
  avatar: {
    type: String,
    default: null,
    trim: true,
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Role is required'],
    index: true,
  },
  /** Direct permission overrides (additive to role permissions). */
  permissions: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Permission',
    },
  ],
  emailVerified: {
    type: Boolean,
    default: false,
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  phone: {
    type: String,
    trim: true,
    default: null,
    maxlength: 32,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  isLocked: {
    type: Boolean,
    default: false,
  },
  lockUntil: {
    type: Date,
    default: null,
  },
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  loginHistory: {
    type: [loginHistorySchema],
    default: [],
    validate: {
      validator(v) {
        return !v || v.length <= 50;
      },
      message: 'loginHistory cannot exceed 50 entries',
    },
  },
  devices: {
    type: [deviceSchema],
    default: [],
    validate: {
      validator(v) {
        return !v || v.length <= 20;
      },
      message: 'devices cannot exceed 20 entries',
    },
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: {
    type: String,
    select: false,
    default: null,
  },
  passwordChangedAt: {
    type: Date,
    default: null,
  },
  emailVerificationToken: {
    type: String,
    select: false,
    default: null,
  },
  emailVerificationExpires: {
    type: Date,
    select: false,
    default: null,
  },
  passwordResetToken: {
    type: String,
    select: false,
    default: null,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
    default: null,
  },
});

applyBaseModel(userSchema, mongoose, { softDelete: true, audit: true });

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } });
userSchema.index({ email: 1, isDeleted: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'devices.deviceId': 1 });

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
    if (!this.isNew) {
      this.passwordChangedAt = new Date(Date.now() - 1000);
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

userSchema.methods.correctPassword = async function correctPassword(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * @param {number} jwtIat - JWT issued-at (seconds)
 * @returns {boolean}
 */
userSchema.methods.changedPasswordAfter = function changedPasswordAfter(jwtIat) {
  if (!this.passwordChangedAt) return false;
  const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return changedTimestamp > jwtIat;
};

userSchema.methods.incrementLoginAttempts = async function incrementLoginAttempts() {
  const maxAttempts = env.ACCOUNT_LOCK_MAX_ATTEMPTS;
  const lockMs = env.ACCOUNT_LOCK_DURATION_MS;

  if (this.lockUntil && this.lockUntil > new Date()) {
    this.loginAttempts += 1;
    return this.save({ validateBeforeSave: false });
  }

  if (this.lockUntil && this.lockUntil <= new Date()) {
    this.isLocked = false;
    this.lockUntil = null;
    this.loginAttempts = 1;
    return this.save({ validateBeforeSave: false });
  }

  this.loginAttempts += 1;

  if (this.loginAttempts >= maxAttempts) {
    this.isLocked = true;
    this.lockUntil = new Date(Date.now() + lockMs);
  }

  return this.save({ validateBeforeSave: false });
};

userSchema.methods.resetLoginAttempts = async function resetLoginAttempts() {
  this.loginAttempts = 0;
  this.isLocked = false;
  this.lockUntil = null;
  return this.save({ validateBeforeSave: false });
};

userSchema.methods.isAccountLocked = function isAccountLocked() {
  return Boolean(this.isLocked && this.lockUntil && this.lockUntil > new Date());
};

userSchema.methods.pushLoginHistory = function pushLoginHistory(entry) {
  this.loginHistory = this.loginHistory || [];
  this.loginHistory.unshift({
    ip: entry.ip,
    userAgent: entry.userAgent,
    at: entry.at || new Date(),
    deviceId: entry.deviceId,
  });
  if (this.loginHistory.length > 50) {
    this.loginHistory = this.loginHistory.slice(0, 50);
  }
};

userSchema.methods.upsertDevice = function upsertDevice(device) {
  this.devices = this.devices || [];
  const idx = this.devices.findIndex((d) => d.deviceId === device.deviceId);
  const payload = {
    deviceId: device.deviceId,
    name: device.name || 'Unknown device',
    lastUsed: new Date(),
    refreshTokenId: device.refreshTokenId || null,
  };
  if (idx >= 0) {
    this.devices[idx] = { ...this.devices[idx].toObject?.() ?? this.devices[idx], ...payload };
  } else {
    this.devices.push(payload);
    if (this.devices.length > 20) {
      this.devices = this.devices.slice(-20);
    }
  }
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export { userSchema, loginHistorySchema, deviceSchema };
export default User;
