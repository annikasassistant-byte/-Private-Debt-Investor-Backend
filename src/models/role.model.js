import mongoose from 'mongoose';
import { applyBaseModel } from './base.model.js';

const { Schema } = mongoose;

const roleSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    trim: true,
    maxlength: 100,
  },
  slug: {
    type: String,
    required: [true, 'Role slug is required'],
    trim: true,
    lowercase: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: 500,
  },
  permissions: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Permission',
    },
  ],
  isSystem: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
});

applyBaseModel(roleSchema, mongoose, { softDelete: true, audit: true });

roleSchema.index({ name: 1 }, { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } });
roleSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } });

roleSchema.pre('validate', function ensureSlug(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);

export { roleSchema };
export default Role;
