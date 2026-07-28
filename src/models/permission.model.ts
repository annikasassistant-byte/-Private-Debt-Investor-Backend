import mongoose from 'mongoose';
import { applyBaseModel } from './base.model.js';

const { Schema } = mongoose;

const permissionSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Permission name is required'],
    trim: true,
    maxlength: 150,
  },
  slug: {
    type: String,
    required: [true, 'Permission slug is required'],
    trim: true,
    lowercase: true,
    maxlength: 150,
  },
  resource: {
    type: String,
    required: [true, 'Resource is required'],
    trim: true,
    lowercase: true,
    maxlength: 100,
    index: true,
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    trim: true,
    lowercase: true,
    maxlength: 50,
    index: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: 500,
  },
});

applyBaseModel(permissionSchema, mongoose, { softDelete: true, audit: true });

permissionSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } });
permissionSchema.index({ resource: 1, action: 1 }, { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } });

permissionSchema.pre('validate', function ensureSlug(next) {
  if (!this.slug && this.resource && this.action) {
    this.slug = `${this.resource}:${this.action}`;
  }
  if (!this.name && this.resource && this.action) {
    this.name = `${this.resource} ${this.action}`;
  }
  next();
});

const Permission = mongoose.models.Permission || mongoose.model('Permission', permissionSchema);

export { permissionSchema };
export default Permission;
