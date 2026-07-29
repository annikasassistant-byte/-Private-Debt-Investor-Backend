import mongoose from 'mongoose';
import { applyBaseModel } from './base.model.js';
import { CONTRACT_TYPE } from '../enums/domain.js';

const { Schema } = mongoose;

const contractSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  type: {
    type: String,
    enum: Object.values(CONTRACT_TYPE),
    default: CONTRACT_TYPE.LOAN_AGREEMENT,
    index: true,
  },
  fileName: { type: String, trim: true, maxlength: 255, default: '' },
  fileUrl: { type: String, trim: true, maxlength: 2048, default: '' },
  mimeType: { type: String, trim: true, maxlength: 120, default: '' },
  sizeBytes: { type: Number, default: 0, min: 0 },
  sizeLabel: { type: String, trim: true, maxlength: 32, default: '' },
  signedAt: { type: Date, default: Date.now },
  assignedInvestors: [{ type: Schema.Types.ObjectId, ref: 'Investor' }],
});

applyBaseModel(contractSchema, mongoose);

export const Contract = mongoose.models.Contract || mongoose.model('Contract', contractSchema);
export { contractSchema };
export default Contract;
