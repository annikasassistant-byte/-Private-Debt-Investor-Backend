import RefreshToken from '../models/refreshToken.model.js';
import { BaseRepository } from './base.repository.js';

export class RefreshTokenRepository extends BaseRepository {
  constructor() {
    super(RefreshToken, 'RefreshToken');
  }

  async findByTokenHash(tokenHash) {
    return this.findOne({ tokenHash, revoked: false });
  }

  async findActiveByUser(userId) {
    return this.model
      .find({ userId, revoked: false, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByFamily(family) {
    return this.model.find({ family }).sort({ createdAt: -1 }).exec();
  }

  async revokeById(id, replacedByToken = null) {
    return this.model.findByIdAndUpdate(
      id,
      {
        $set: {
          revoked: true,
          revokedAt: new Date(),
          ...(replacedByToken ? { replacedByToken } : {}),
        },
      },
      { new: true },
    );
  }

  async revokeFamily(family) {
    return this.model.updateMany(
      { family, revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } },
    );
  }

  async revokeAllForUser(userId) {
    return this.model.updateMany(
      { userId, revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } },
    );
  }

  async revokeByDevice(userId, deviceId) {
    return this.model.updateMany(
      { userId, deviceId, revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } },
    );
  }
}

export default RefreshTokenRepository;
