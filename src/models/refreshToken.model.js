import mongoose from 'mongoose';
import { applyBaseModel } from './base.model.js';

const { Schema } = mongoose;

/**
 * Optional Mongo backup for refresh tokens (primary store is Redis).
 */
const refreshTokenSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    index: true,
  },
  deviceId: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  revoked: {
    type: Boolean,
    default: false,
    index: true,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  replacedByToken: {
    type: String,
    default: null,
  },
  family: {
    type: String,
    required: true,
    index: true,
  },
  userAgent: {
    type: String,
    default: null,
  },
  ip: {
    type: String,
    default: null,
  },
});

applyBaseModel(refreshTokenSchema, mongoose, { softDelete: false, audit: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1, revoked: 1 });
refreshTokenSchema.index({ family: 1, revoked: 1 });

refreshTokenSchema.methods.revoke = async function revoke(replacedByToken = null) {
  this.revoked = true;
  this.revokedAt = new Date();
  if (replacedByToken) this.replacedByToken = replacedByToken;
  return this.save();
};

const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);

export { refreshTokenSchema };
export default RefreshToken;
