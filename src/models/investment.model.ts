import mongoose from 'mongoose';
import { applyBaseModel } from './base.model.js';
import { INVESTMENT_STATUS, REPAYMENT_MODEL } from '../enums/domain.js';

const { Schema } = mongoose;

const investmentSchema = new Schema({
  investor: { type: Schema.Types.ObjectId, ref: 'Investor', required: true, index: true },
  investorName: { type: String, trim: true, maxlength: 200, default: '' },
  principal: { type: Number, required: true, min: 0 },
  interestRate: { type: Number, required: true, min: 0 },
  termMonths: { type: Number, required: true, min: 1 },
  monthlyPayment: { type: Number, default: 0, min: 0 },
  outstandingBalance: { type: Number, default: 0, min: 0 },
  interestEarned: { type: Number, default: 0, min: 0 },
  principalRepaid: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: Object.values(INVESTMENT_STATUS),
    default: INVESTMENT_STATUS.PENDING,
    index: true,
  },
  startDate: { type: Date, required: true },
  maturityDate: { type: Date, required: true },
  paymentDay: { type: Number, min: 1, max: 28, default: 15 },
  repaymentModel: {
    type: String,
    enum: Object.values(REPAYMENT_MODEL),
    default: REPAYMENT_MODEL.AMORTIZING,
  },
  gracePeriodMonths: { type: Number, default: 0, min: 0 },
  balloonAmount: { type: Number, default: 0, min: 0 },
  nextPaymentDate: { type: Date, default: null },
  nextPaymentAmount: { type: Number, default: 0, min: 0 },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
});

applyBaseModel(investmentSchema, mongoose);
investmentSchema.index({ investor: 1, status: 1 });

export const Investment =
  mongoose.models.Investment || mongoose.model('Investment', investmentSchema);
export { investmentSchema };
export default Investment;
