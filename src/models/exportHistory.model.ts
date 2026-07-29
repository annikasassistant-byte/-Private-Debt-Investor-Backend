import mongoose from 'mongoose';
import { applyBaseModel } from './base.model.js';

const { Schema } = mongoose;

const exportHistorySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  investor: { type: Schema.Types.ObjectId, ref: 'Investor', default: null, index: true },
  investment: { type: Schema.Types.ObjectId, ref: 'Investment', default: null, index: true },
  format: { type: String, enum: ['csv', 'pdf', 'xlsx'], required: true },
  type: { type: String, default: 'payment_schedule', maxlength: 64 },
  filename: { type: String, trim: true, maxlength: 255, default: '' },
  meta: { type: Schema.Types.Mixed, default: {} },
});

applyBaseModel(exportHistorySchema, mongoose, { softDelete: false, audit: false });
exportHistorySchema.index({ createdAt: -1 });

export const ExportHistory =
  mongoose.models.ExportHistory || mongoose.model('ExportHistory', exportHistorySchema);
export { exportHistorySchema };
export default ExportHistory;
