import type { Schema } from 'mongoose';
import type mongooseNS from 'mongoose';

export type BaseModelOptions = {
  softDelete?: boolean;
  audit?: boolean;
};

/**
 * Apply reusable soft-delete, audit, timestamps, and optimistic concurrency.
 */
export function applyBaseModel(
  schema: Schema,
  mongoose: typeof mongooseNS,
  options: BaseModelOptions = {},
): Schema {
  const { softDelete = true, audit = true } = options;
  const { Schema } = mongoose;

  if (audit) {
    schema.add({
      createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
      updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    });
  }

  if (softDelete) {
    schema.add({
      isDeleted: { type: Boolean, default: false, index: true },
      deletedAt: { type: Date, default: null, index: true },
      deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    });
  }

  schema.set('timestamps', true);
  schema.set('versionKey', '__v');
  schema.set('optimisticConcurrency', true);

  schema.set('toJSON', {
    virtuals: true,
    versionKey: true,
    transform(_doc, ret) {
      delete ret.password;
      delete ret.twoFactorSecret;
      return ret;
    },
  });

  schema.set('toObject', { virtuals: true, versionKey: true });

  if (softDelete) {
    const softDeleteFilter = function softDeleteFilter() {
      if (this.getOptions()?.includeDeleted) return;
      const query = this.getQuery();
      if (query.isDeleted === undefined && query.deletedAt === undefined) {
        this.where({ isDeleted: { $ne: true } });
      }
    };

    schema.pre('find', softDeleteFilter);
    schema.pre('findOne', softDeleteFilter);
    schema.pre('findOneAndUpdate', softDeleteFilter);
    schema.pre('countDocuments', softDeleteFilter);

    schema.statics.softDeleteById = async function softDeleteById(id, deletedBy = null) {
      return this.findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            ...(deletedBy ? { deletedBy, updatedBy: deletedBy } : {}),
          },
        },
        { new: true },
      );
    };

    schema.statics.restoreById = async function restoreById(id, restoredBy = null) {
      return this.findOneAndUpdate(
        { _id: id, isDeleted: true },
        {
          $set: {
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
            ...(restoredBy ? { updatedBy: restoredBy } : {}),
          },
        },
        { new: true, includeDeleted: true },
      );
    };

    schema.methods.softDelete = async function softDeleteMethod(deletedBy = null) {
      this.isDeleted = true;
      this.deletedAt = new Date();
      if (deletedBy) {
        this.deletedBy = deletedBy;
        this.updatedBy = deletedBy;
      }
      return this.save();
    };

    schema.methods.restore = async function restoreMethod(restoredBy = null) {
      this.isDeleted = false;
      this.deletedAt = null;
      this.deletedBy = null;
      if (restoredBy) this.updatedBy = restoredBy;
      return this.save();
    };
  }

  if (audit) {
    schema.pre('save', function auditSave(next) {
      const actor = this.$locals?.actor || this.__actor;
      if (actor) {
        if (this.isNew && !this.createdBy) this.createdBy = actor;
        this.updatedBy = actor;
      }
      next();
    });

    schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function auditUpdate(next) {
      const actor = this.getOptions()?.actor;
      if (actor) this.set({ updatedBy: actor });
      next();
    });
  }

  return schema;
}

/** Alias for applyBaseModel for callers expecting a plugin-style name. */
export function baseModelPlugin(
  schema: Schema,
  mongoose: typeof mongooseNS,
  options: BaseModelOptions = {},
): Schema {
  return applyBaseModel(schema, mongoose, options);
}

export default applyBaseModel;
