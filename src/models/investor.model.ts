import mongoose from 'mongoose';
import { applyBaseModel } from './base.model.js';
import { INVESTOR_STATUS } from '../enums/domain.js';

const { Schema } = mongoose;

const investorSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 255, index: true },
  phone: { type: String, trim: true, maxlength: 32, default: '' },
  company: { type: String, trim: true, maxlength: 200, default: '' },
  title: { type: String, trim: true, maxlength: 120, default: '' },
  status: {
    type: String,
    enum: Object.values(INVESTOR_STATUS),
    default: INVESTOR_STATUS.ACTIVE,
    index: true,
  },
  totalInvested: { type: Number, default: 0, min: 0 },
  outstandingBalance: { type: Number, default: 0, min: 0 },
  joinedAt: { type: Date, default: Date.now },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
});

applyBaseModel(investorSchema, mongoose);
investorSchema.index({ name: 'text', email: 'text', company: 'text' });

export const Investor = mongoose.models.Investor || mongoose.model('Investor', investorSchema);
export { investorSchema };
export default Investor;
