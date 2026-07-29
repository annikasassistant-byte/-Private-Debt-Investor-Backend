import mongoose from 'mongoose';
import { applyBaseModel } from './base.model.js';
import { REPORT_CATEGORY } from '../enums/domain.js';

const { Schema } = mongoose;

const reportSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  category: {
    type: String,
    enum: Object.values(REPORT_CATEGORY),
    default: REPORT_CATEGORY.OTHER,
    index: true,
  },
  period: { type: String, trim: true, maxlength: 120, default: '' },
  fileName: { type: String, trim: true, maxlength: 255, default: '' },
  fileUrl: { type: String, trim: true, maxlength: 2048, default: '' },
  mimeType: { type: String, trim: true, maxlength: 120, default: '' },
  sizeBytes: { type: Number, default: 0, min: 0 },
  sizeLabel: { type: String, trim: true, maxlength: 32, default: '' },
  uploadedAt: { type: Date, default: Date.now },
  assignedInvestors: [{ type: Schema.Types.ObjectId, ref: 'Investor' }],
});

applyBaseModel(reportSchema, mongoose);

export const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);
export { reportSchema };
export default Report;
