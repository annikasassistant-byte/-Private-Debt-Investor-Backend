import mongoose from 'mongoose';
import { applyBaseModel } from './base.model.js';
import { PAYMENT_STATUS } from '../enums/domain.js';

const { Schema } = mongoose;

const paymentSchema = new Schema({
  investment: { type: Schema.Types.ObjectId, ref: 'Investment', required: true, index: true },
  investor: { type: Schema.Types.ObjectId, ref: 'Investor', required: true, index: true },
  sequence: { type: Number, required: true, min: 1 },
  dueDate: { type: Date, required: true, index: true },
  paymentDate: { type: Date, default: null },
  principal: { type: Number, required: true, min: 0 },
  interest: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  remainingBalance: { type: Number, required: true, min: 0 },
  amountPaid: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.SCHEDULED,
    index: true,
  },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  contractualDueDate: { type: Date, default: null },
  dateAdjustmentNote: { type: String, trim: true, maxlength: 500, default: '' },
});

applyBaseModel(paymentSchema, mongoose);
paymentSchema.index({ investment: 1, sequence: 1 }, { unique: true });
paymentSchema.index({ investor: 1, dueDate: 1 });

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export { paymentSchema };
export default Payment;
